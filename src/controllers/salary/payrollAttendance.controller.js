const sequelize = require("../../config/database");

const { Op, QueryTypes } = require("sequelize");

const {
  User,
  UserSalaryConfig,

  PayrollPeriod,
  PayrollAttendance,
  PayrollAttendanceAdjustment,

  EmployeePayroll,
  PayrollLog,
} = require("../../models");

// ==========================================================
// HELPER
// TÍNH CÔNG CHUẨN FULL-TIME
//
// Công ty:
// Thứ 2 -> Thứ 6
//
// Ví dụ:
// 11/09/2026 -> 10/10/2026
// => số ngày T2-T6 của kỳ
// ==========================================================

const calculateFullTimeStandardDays = (startDate, endDate) => {
  if (!startDate || !endDate) {
    return 0;
  }

  const start = new Date(`${startDate}T00:00:00`);

  const end = new Date(`${endDate}T00:00:00`);

  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    end < start
  ) {
    return 0;
  }

  let total = 0;

  const current = new Date(start);

  while (current <= end) {
    const day = current.getDay();

    // 0 = CN
    // 1 = T2
    // ...
    // 5 = T6
    // 6 = T7

    if (day >= 1 && day <= 5) {
      total += 1;
    }

    current.setDate(current.getDate() + 1);
  }

  return total;
};

// ==========================================================
// HELPER
// LẤY SALARY CONFIG ĐANG CÓ HIỆU LỰC
// ==========================================================

const getActiveSalaryConfig = async (userId, periodEndDate, transaction) => {
  return UserSalaryConfig.findOne({
    where: {
      user_id: userId,

      status: 1,

      effective_from: {
        [Op.lte]: periodEndDate,
      },

      [Op.or]: [
        {
          effective_to: null,
        },

        {
          effective_to: {
            [Op.gte]: periodEndDate,
          },
        },
      ],
    },

    order: [["effective_from", "DESC"]],

    transaction,
  });
};

// ==========================================================
// HELPER
// CÔNG CHUẨN THEO LOẠI NHÂN SỰ
// ==========================================================

const resolveStandardWorkDays = ({ employeeType, fullTimeStandardDays }) => {
  const type = String(employeeType || "")
    .trim()
    .toUpperCase();

  // ==========================================
  // NHÂN VIÊN CHÍNH THỨC / THỬ VIỆC
  // ==========================================

  if (type === "OFFICIAL" || type === "PROBATION") {
    return fullTimeStandardDays;
  }

  // ==========================================
  // THỰC TẬP / PART-TIME
  //
  // Theo rule hiện tại của bạn:
  // 3 ngày / tuần
  // => 12 công / kỳ
  // ==========================================

  if (type === "INTERN" || type === "PART_TIME") {
    return 12;
  }

  // ==========================================
  // CTV
  // ==========================================

  if (type === "COLLABORATOR") {
    return 12;
  }

  return null;
};

// ==========================================================
// GET CÔNG CỦA KỲ LƯƠNG
// ==========================================================

exports.getPayrollAttendances = async (req, res) => {
  try {
    const { payroll_period_id } = req.query;

    const where = {};

    if (payroll_period_id) {
      where.payroll_period_id = payroll_period_id;
    }

    const data = await PayrollAttendance.findAll({
      where,

      include: [
        {
          model: User,

          as: "user",

          attributes: ["user_id", "name", "position", "email", "avatar"],
        },

        {
          model: PayrollAttendanceAdjustment,

          as: "adjustments",

          required: false,
        },
      ],

      order: [["user_id", "ASC"]],
    });

    // ======================================================
    // GẮN employee_type VÀO RESPONSE
    //
    // Để frontend hiện:
    // Chính thức / Thực tập / Part-time...
    // ======================================================

    const result = [];

    for (const attendance of data) {
      const json = attendance.toJSON();

      const period = payroll_period_id
        ? await PayrollPeriod.findByPk(attendance.payroll_period_id)
        : null;

      const salaryConfig = period
        ? await getActiveSalaryConfig(attendance.user_id, period.end_date, null)
        : null;

      result.push({
        ...json,

        employee_type: salaryConfig?.employee_type || null,
      });
    }

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("getPayrollAttendances:", error);

    return res.status(500).json({
      success: false,

      message: "Không thể lấy dữ liệu công",

      error: error.message,
    });
  }
};

// ==========================================================
// SYNC CÔNG TRỰC TIẾP TỪ HỆ THỐNG CHẤM CÔNG
//
// POST /salary/attendance/sync
//
// body:
// {
//    payroll_period_id: 1
// }
//
// RULE CÔNG:
//
// >= 6 giờ
// => 1 công
//
// >= 2.5 giờ và < 6 giờ
// => 0.5 công
//
// < 2.5 giờ
// => 0 công
//
// CÔNG CHUẨN:
//
// OFFICIAL / PROBATION
// => số ngày T2-T6 của kỳ
//
// INTERN / PART_TIME
// => 12
// ==========================================================

exports.syncPayrollAttendance = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { payroll_period_id } = req.body;

    if (!payroll_period_id) {
      await transaction.rollback();

      return res.status(400).json({
        success: false,

        message: "Thiếu payroll_period_id",
      });
    }

    // ======================================================
    // 1. KỲ LƯƠNG
    // ======================================================

    const period = await PayrollPeriod.findByPk(payroll_period_id, {
      transaction,
    });

    if (!period) {
      await transaction.rollback();

      return res.status(404).json({
        success: false,

        message: "Không tìm thấy kỳ lương",
      });
    }

    if (["PUBLISHED", "CLOSED"].includes(period.status)) {
      await transaction.rollback();

      return res.status(400).json({
        success: false,

        message: "Kỳ lương đã khóa",
      });
    }

    // ======================================================
    // 2. TÍNH CÔNG CHUẨN FULL-TIME
    // ======================================================

    const fullTimeStandardDays = calculateFullTimeStandardDays(
      period.start_date,
      period.end_date,
    );

    // ======================================================
    // 3. QUERY CHẤM CÔNG
    // ======================================================

    const attendanceData = await sequelize.query(
      `
        SELECT
            u.user_id,
            u.name,

            SUM(
                CASE

                    WHEN (
                        EXTRACT(
                            EPOCH
                            FROM (
                                tk.check_out
                                -
                                tk.check_in
                            )
                        )
                        /
                        3600
                    ) >= 6.0

                    THEN 1.0

                    WHEN (
                        EXTRACT(
                            EPOCH
                            FROM (
                                tk.check_out
                                -
                                tk.check_in
                            )
                        )
                        /
                        3600
                    ) >= 2.5

                    AND (
                        EXTRACT(
                            EPOCH
                            FROM (
                                tk.check_out
                                -
                                tk.check_in
                            )
                        )
                        /
                        3600
                    ) < 6.0

                    THEN 0.5

                    ELSE 0.0

                END
            )::numeric(10,2)
            AS attendance_work_days

        FROM
            timekeeping.tk_attendance tk

        JOIN
            mdm.users u

            ON u.user_id =
               tk.user_id

        WHERE
            tk.work_date
            BETWEEN
                :startDate
                AND
                :endDate

            AND tk.check_in
                IS NOT NULL

            AND tk.check_out
                IS NOT NULL

            AND COALESCE(
                u.status,
                1
            ) = 1

        GROUP BY
            u.user_id,
            u.name

        ORDER BY
            u.user_id ASC
        `,
      {
        replacements: {
          startDate: period.start_date,

          endDate: period.end_date,
        },

        type: QueryTypes.SELECT,

        transaction,
      },
    );

    if (attendanceData.length === 0) {
      await transaction.rollback();

      return res.status(400).json({
        success: false,

        message: "Không tìm thấy dữ liệu chấm công trong kỳ",
      });
    }

    let createdCount = 0;

    let updatedCount = 0;

    let unchangedCount = 0;

    let skippedCount = 0;

    const result = [];

    // ======================================================
    // 4. LOOP NHÂN VIÊN
    // ======================================================

    for (const item of attendanceData) {
      const userId = Number(item.user_id);

      const actualWorkDays = Number(item.attendance_work_days || 0);

      // ====================================================
      // SALARY CONFIG
      // ====================================================

      const salaryConfig = await getActiveSalaryConfig(
        userId,
        period.end_date,
        transaction,
      );

      if (!salaryConfig) {
        //console.log(`[PAYROLL] User ${userId} chưa có cấu hình lương`);

        skippedCount += 1;

        continue;
      }

      const employeeType = String(salaryConfig.employee_type || "")
        .trim()
        .toUpperCase();

      // ====================================================
      // CÔNG CHUẨN RIÊNG
      // ====================================================

      const standardWorkDays = resolveStandardWorkDays({
        employeeType,

        fullTimeStandardDays,
      });

      if (standardWorkDays === null) {
        console.log(
          `[PAYROLL] employee_type không hỗ trợ: user=${userId}, type=${employeeType}`,
        );

        skippedCount += 1;

        continue;
      }

      console.log("[PAYROLL SYNC]", {
        userId,

        employeeType,

        standardWorkDays,

        actualWorkDays,
      });

      // ====================================================
      // ATTENDANCE HIỆN TẠI
      // ====================================================

      const existing = await PayrollAttendance.findOne({
        where: {
          payroll_period_id,

          user_id: userId,
        },

        transaction,

        lock: transaction.LOCK.UPDATE,
      });

      // ====================================================
      // CREATE
      // ====================================================

      if (!existing) {
        const attendance = await PayrollAttendance.create(
          {
            payroll_period_id,

            user_id: userId,

            standard_work_days: standardWorkDays,

            attendance_work_days: actualWorkDays,

            adjustment_work_days: 0,

            confirmed_work_days: actualWorkDays,

            attendance_version: 1,

            status: "DRAFT",

            confirmed_by: null,

            confirmed_at: null,

            created_at: new Date(),
          },
          {
            transaction,
          },
        );

        createdCount += 1;

        result.push(attendance);

        continue;
      }

      // ====================================================
      // SO SÁNH
      // ====================================================

      const oldStandard = Number(existing.standard_work_days || 0);

      const oldActual = Number(existing.attendance_work_days || 0);

      const standardChanged = oldStandard !== standardWorkDays;

      const attendanceChanged = oldActual !== actualWorkDays;

      if (!standardChanged && !attendanceChanged) {
        unchangedCount += 1;

        result.push(existing);

        continue;
      }

      // ====================================================
      // UPDATE
      // ====================================================

      const adjustment = Number(existing.adjustment_work_days || 0);

      const newConfirmed = actualWorkDays + adjustment;

      const newVersion = Number(existing.attendance_version || 0) + 1;

      await existing.update(
        {
          standard_work_days: standardWorkDays,

          attendance_work_days: actualWorkDays,

          confirmed_work_days: newConfirmed,

          attendance_version: newVersion,

          status: existing.status === "DRAFT" ? "DRAFT" : "CHANGED",

          confirmed_by:
            existing.status === "DRAFT" ? existing.confirmed_by : null,

          confirmed_at:
            existing.status === "DRAFT" ? existing.confirmed_at : null,

          updated_at: new Date(),
        },
        {
          transaction,
        },
      );

      // ====================================================
      // PAYROLL ĐÃ TÍNH -> OUTDATED
      // ====================================================

      await EmployeePayroll.update(
        {
          status: "OUTDATED",

          updated_at: new Date(),
        },
        {
          where: {
            payroll_period_id,

            user_id: userId,
          },

          transaction,
        },
      );

      // ====================================================
      // LOG
      // ====================================================

      await PayrollLog.create(
        {
          payroll_period_id,

          user_id: userId,

          action: "SYNC_ATTENDANCE",

          old_data: {
            standard_work_days: oldStandard,

            attendance_work_days: oldActual,

            attendance_version: Number(existing.attendance_version || 0) - 1,
          },

          new_data: {
            employee_type: employeeType,

            standard_work_days: standardWorkDays,

            attendance_work_days: actualWorkDays,

            confirmed_work_days: newConfirmed,

            attendance_version: newVersion,
          },

          description: "Cập nhật dữ liệu từ hệ thống chấm công",

          created_by: req.user?.user_id || null,
        },
        {
          transaction,
        },
      );

      updatedCount += 1;

      result.push(existing);
    }

    // ======================================================
    // 5. NẾU CÓ THAY ĐỔI -> PERIOD VỀ OPEN
    // ======================================================

    if (createdCount > 0 || updatedCount > 0) {
      await period.update(
        {
          status: "OPEN",
        },
        {
          transaction,
        },
      );
    }

    await transaction.commit();

    return res.json({
      success: true,

      message:
        `Đồng bộ công thành công. ` +
        `Thêm mới: ${createdCount}, ` +
        `cập nhật: ${updatedCount}, ` +
        `không đổi: ${unchangedCount}, ` +
        `bỏ qua: ${skippedCount}.`,

      data: {
        created: createdCount,

        updated: updatedCount,

        unchanged: unchangedCount,

        skipped: skippedCount,

        total: attendanceData.length,

        full_time_standard_days: fullTimeStandardDays,

        result,
      },
    });
  } catch (error) {
    await transaction.rollback();

    console.error("syncPayrollAttendance:", error);

    return res.status(500).json({
      success: false,

      message: "Không thể đồng bộ dữ liệu chấm công",

      error: error.message,
    });
  }
};

// ==========================================================
// SYNC DỮ LIỆU CHẤM CÔNG
//
// GIỜ LÀM VIỆC CÔNG TY:
//
// Sáng:
// 09:00 -> 12:00
//
// Chiều:
// 13:00 -> 17:00
//
// Tổng tối đa:
// 7 giờ / ngày
//
// Công thực tế:
// Tổng giờ hợp lệ / 7
//
// Ví dụ:
// 7h     = 1.000 công
// 6.5h   = 0.929 công
// 5.5h   = 0.786 công
//
// Công chuẩn:
//
// OFFICIAL / PROBATION
// => số ngày T2 -> T6 trong kỳ
//
// INTERN / PART_TIME
// => 12 công
// ==========================================================

// exports.syncPayrollAttendance = async (req, res) => {
//   const transaction = await sequelize.transaction();

//   try {
//     const { payroll_period_id } = req.body;

//     // ======================================================
//     // 1. VALIDATE
//     // ======================================================

//     if (!payroll_period_id) {
//       await transaction.rollback();

//       return res.status(400).json({
//         success: false,

//         message: "Thiếu payroll_period_id",
//       });
//     }

//     // ======================================================
//     // 2. LẤY KỲ LƯƠNG
//     // ======================================================

//     const period = await PayrollPeriod.findByPk(payroll_period_id, {
//       transaction,
//     });

//     if (!period) {
//       await transaction.rollback();

//       return res.status(404).json({
//         success: false,

//         message: "Không tìm thấy kỳ lương",
//       });
//     }

//     // ======================================================
//     // KHÔNG CHO SYNC KỲ ĐÃ KHÓA
//     // ======================================================

//     if (["PUBLISHED", "CLOSED"].includes(period.status)) {
//       await transaction.rollback();

//       return res.status(400).json({
//         success: false,

//         message: "Kỳ lương đã công bố hoặc đã đóng, không thể cập nhật công",
//       });
//     }

//     // ======================================================
//     // 3. TÍNH CÔNG CHUẨN FULL-TIME
//     //
//     // T2 -> T6
//     // ======================================================

//     const startDate = new Date(`${period.start_date}T00:00:00`);

//     const endDate = new Date(`${period.end_date}T00:00:00`);

//     let fullTimeStandardDays = 0;

//     const currentDate = new Date(startDate);

//     while (currentDate <= endDate) {
//       const day = currentDate.getDay();

//       // 1 = T2
//       // ...
//       // 5 = T6

//       if (day >= 1 && day <= 5) {
//         fullTimeStandardDays += 1;
//       }

//       currentDate.setDate(currentDate.getDate() + 1);
//     }

//     // ======================================================
//     // 4. QUERY DỮ LIỆU CHẤM CÔNG
//     //
//     // QUY TẮC:
//     //
//     // chỉ tính phần thời gian giao với:
//     //
//     // 09:00 -> 12:00
//     // 13:00 -> 17:00
//     //
//     // Không tính:
//     // - trước 09:00
//     // - 12:00 -> 13:00
//     // - sau 17:00
//     //
//     // daily_work_hours:
//     // giờ hợp lệ từng ngày
//     //
//     // attendance_work_days:
//     // tổng giờ / 7
//     // ======================================================

//     const attendanceData = await sequelize.query(
//       `
//     WITH daily_attendance AS (
//         SELECT
//             tk.user_id,
//             tk.work_date,

//             -- ==========================================
//             -- BUỔI SÁNG
//             -- CHỈ TÍNH 09:00 -> 12:00
//             -- ==========================================

//             CASE
//                 WHEN
//                     tk.check_out::time > TIME '09:00:00'
//                     AND
//                     tk.check_in::time < TIME '12:00:00'

//                 THEN
//                     GREATEST(
//                         0,

//                         EXTRACT(
//                             EPOCH FROM (
//                                 LEAST(
//                                     tk.check_out::time,
//                                     TIME '12:00:00'
//                                 )
//                                 -
//                                 GREATEST(
//                                     tk.check_in::time,
//                                     TIME '09:00:00'
//                                 )
//                             )
//                         ) / 3600.0
//                     )

//                 ELSE 0
//             END

//             +

//             -- ==========================================
//             -- BUỔI CHIỀU
//             -- CHỈ TÍNH 13:00 -> 17:00
//             -- ==========================================

//             CASE
//                 WHEN
//                     tk.check_out::time > TIME '13:00:00'
//                     AND
//                     tk.check_in::time < TIME '17:00:00'

//                 THEN
//                     GREATEST(
//                         0,

//                         EXTRACT(
//                             EPOCH FROM (
//                                 LEAST(
//                                     tk.check_out::time,
//                                     TIME '17:00:00'
//                                 )
//                                 -
//                                 GREATEST(
//                                     tk.check_in::time,
//                                     TIME '13:00:00'
//                                 )
//                             )
//                         ) / 3600.0
//                     )

//                 ELSE 0
//             END

//             AS valid_work_hours

//         FROM
//             timekeeping.tk_attendance tk

//         WHERE
//             tk.work_date
//             BETWEEN
//                 :startDate
//                 AND
//                 :endDate

//             AND tk.check_in IS NOT NULL
//             AND tk.check_out IS NOT NULL
//     ),

//     employee_hours AS (
//         SELECT
//             user_id,

//             SUM(
//                 LEAST(
//                     valid_work_hours,
//                     7.0
//                 )
//             )::numeric(12,2)
//             AS total_work_hours

//         FROM daily_attendance

//         GROUP BY user_id
//     )

//     SELECT
//         u.user_id,

//         u.name,

//         eh.total_work_hours,

//         ROUND(
//             (
//                 eh.total_work_hours
//                 /
//                 7.0
//             )::numeric,
//             3
//         )
//         AS attendance_work_days

//     FROM employee_hours eh

//     JOIN mdm.users u
//         ON u.user_id =
//            eh.user_id

//     WHERE
//         COALESCE(
//             u.status,
//             1
//         ) = 1

//     ORDER BY
//         u.user_id ASC
//     `,
//       {
//         replacements: {
//           startDate: period.start_date,

//           endDate: period.end_date,
//         },

//         type: QueryTypes.SELECT,

//         transaction,
//       },
//     );

//     // ======================================================
//     // KHÔNG CÓ DỮ LIỆU
//     // ======================================================

//     if (attendanceData.length === 0) {
//       await transaction.rollback();

//       return res.status(400).json({
//         success: false,

//         message: "Không tìm thấy dữ liệu chấm công trong kỳ",
//       });
//     }

//     // ======================================================
//     // COUNTER
//     // ======================================================

//     let createdCount = 0;

//     let updatedCount = 0;

//     let unchangedCount = 0;

//     let skippedCount = 0;

//     const result = [];

//     // ======================================================
//     // 5. LOOP NHÂN VIÊN
//     // ======================================================

//     for (const item of attendanceData) {
//       const userId = Number(item.user_id);

//       const totalWorkHours = Number(item.total_work_hours || 0);

//       const actualWorkDays = Number(item.attendance_work_days || 0);

//       // ====================================================
//       // 6. TÌM CẤU HÌNH LƯƠNG ĐANG CÓ HIỆU LỰC
//       // ====================================================

//       const salaryConfig = await UserSalaryConfig.findOne({
//         where: {
//           user_id: userId,

//           status: 1,

//           effective_from: {
//             [Op.lte]: period.end_date,
//           },

//           [Op.or]: [
//             {
//               effective_to: null,
//             },

//             {
//               effective_to: {
//                 [Op.gte]: period.end_date,
//               },
//             },
//           ],
//         },

//         order: [["effective_from", "DESC"]],

//         transaction,
//       });

//       // ====================================================
//       // CHƯA KHAI BÁO LƯƠNG
//       // ====================================================

//       if (!salaryConfig) {
//         //console.log(`[PAYROLL] User ${userId} chưa có cấu hình lương`);

//         skippedCount += 1;

//         continue;
//       }

//       // ====================================================
//       // 7. LOẠI NHÂN SỰ
//       // ====================================================

//       const employeeType = String(salaryConfig.employee_type || "")
//         .trim()
//         .toUpperCase();

//       // ====================================================
//       // 8. TÍNH CÔNG CHUẨN
//       // ====================================================

//       let standardWorkDays = null;

//       // ================================================
//       // NHÂN VIÊN CHÍNH THỨC
//       // ================================================

//       if (employeeType === "OFFICIAL" || employeeType === "PROBATION") {
//         standardWorkDays = fullTimeStandardDays;
//       }

//       // ================================================
//       // THỰC TẬP / PART-TIME
//       // ================================================
//       else if (employeeType === "INTERN" || employeeType === "PART_TIME") {
//         standardWorkDays = 12;
//       }

//       // ================================================
//       // CỘNG TÁC VIÊN
//       // ================================================
//       else if (employeeType === "COLLABORATOR") {
//         standardWorkDays = 12;
//       }

//       // ================================================
//       // KHÔNG NHẬN DIỆN
//       // ================================================

//       if (standardWorkDays === null) {
//         console.log(
//           `[PAYROLL] Không xác định được loại nhân sự của user ${userId}: ${employeeType}`,
//         );

//         skippedCount += 1;

//         continue;
//       }

//       // ====================================================
//       // DEBUG
//       // ====================================================

//       // console.log("[PAYROLL SYNC]", {
//       //   userId,

//       //   name: item.name,

//       //   employeeType,

//       //   standardWorkDays,

//       //   totalWorkHours,

//       //   actualWorkDays,
//       // });

//       // ====================================================
//       // 9. TÌM RECORD CÔNG HIỆN TẠI
//       // ====================================================

//       const existing = await PayrollAttendance.findOne({
//         where: {
//           payroll_period_id: payroll_period_id,

//           user_id: userId,
//         },

//         transaction,

//         lock: transaction.LOCK.UPDATE,
//       });

//       // ====================================================
//       // 10. CHƯA CÓ -> CREATE
//       // ====================================================

//       if (!existing) {
//         const attendance = await PayrollAttendance.create(
//           {
//             payroll_period_id: payroll_period_id,

//             user_id: userId,

//             standard_work_days: standardWorkDays,

//             // ============================================
//             // CÔNG THỰC TẾ ĐÃ QUY ĐỔI THEO GIỜ
//             // ============================================

//             attendance_work_days: actualWorkDays,

//             adjustment_work_days: 0,

//             confirmed_work_days: actualWorkDays,

//             attendance_version: 1,

//             status: "DRAFT",

//             confirmed_by: null,

//             confirmed_at: null,

//             created_at: new Date(),
//           },
//           {
//             transaction,
//           },
//         );

//         createdCount += 1;

//         result.push({
//           ...attendance.toJSON(),

//           employee_type: employeeType,

//           total_work_hours: totalWorkHours,
//         });

//         continue;
//       }

//       // ====================================================
//       // 11. SO SÁNH DỮ LIỆU CŨ / MỚI
//       // ====================================================

//       const oldStandardDays = Number(existing.standard_work_days || 0);

//       const oldActualDays = Number(existing.attendance_work_days || 0);

//       const standardChanged = oldStandardDays !== Number(standardWorkDays);

//       const attendanceChanged =
//         Math.abs(oldActualDays - actualWorkDays) > 0.0001;

//       // ====================================================
//       // KHÔNG THAY ĐỔI
//       // ====================================================

//       if (!standardChanged && !attendanceChanged) {
//         unchangedCount += 1;

//         result.push({
//           ...existing.toJSON(),

//           employee_type: employeeType,

//           total_work_hours: totalWorkHours,
//         });

//         continue;
//       }

//       // ====================================================
//       // 12. TÍNH LẠI CÔNG SAU ĐIỀU CHỈNH
//       // ====================================================

//       const adjustment = Number(existing.adjustment_work_days || 0);

//       const newConfirmedDays = Number((actualWorkDays + adjustment).toFixed(3));

//       const newVersion = Number(existing.attendance_version || 0) + 1;

//       const previousStatus = existing.status;

//       // ====================================================
//       // 13. UPDATE ATTENDANCE
//       // ====================================================

//       await existing.update(
//         {
//           standard_work_days: standardWorkDays,

//           attendance_work_days: actualWorkDays,

//           adjustment_work_days: adjustment,

//           confirmed_work_days: newConfirmedDays,

//           attendance_version: newVersion,

//           /*
//            * Nếu đang DRAFT thì vẫn DRAFT.
//            *
//            * Nếu đã CONFIRMED trước đó
//            * mà dữ liệu thay đổi
//            * => CHANGED.
//            */

//           status: previousStatus === "DRAFT" ? "DRAFT" : "CHANGED",

//           confirmed_by:
//             previousStatus === "DRAFT" ? existing.confirmed_by : null,

//           confirmed_at:
//             previousStatus === "DRAFT" ? existing.confirmed_at : null,

//           updated_at: new Date(),
//         },
//         {
//           transaction,
//         },
//       );

//       // ====================================================
//       // 14. BẢNG LƯƠNG ĐÃ TÍNH -> OUTDATED
//       // ====================================================

//       await EmployeePayroll.update(
//         {
//           status: "OUTDATED",

//           updated_at: new Date(),
//         },
//         {
//           where: {
//             payroll_period_id: payroll_period_id,

//             user_id: userId,
//           },

//           transaction,
//         },
//       );

//       // ====================================================
//       // 15. LOG
//       // ====================================================

//       await PayrollLog.create(
//         {
//           payroll_period_id: payroll_period_id,

//           user_id: userId,

//           action: "SYNC_ATTENDANCE",

//           old_data: {
//             standard_work_days: oldStandardDays,

//             attendance_work_days: oldActualDays,

//             attendance_version: Number(existing.attendance_version || 1) - 1,
//           },

//           new_data: {
//             employee_type: employeeType,

//             standard_work_days: standardWorkDays,

//             total_work_hours: totalWorkHours,

//             attendance_work_days: actualWorkDays,

//             adjustment_work_days: adjustment,

//             confirmed_work_days: newConfirmedDays,

//             attendance_version: newVersion,
//           },

//           description: "Đồng bộ lại dữ liệu từ hệ thống chấm công",

//           created_by: req.user?.user_id || null,
//         },
//         {
//           transaction,
//         },
//       );

//       updatedCount += 1;

//       result.push({
//         ...existing.toJSON(),

//         employee_type: employeeType,

//         total_work_hours: totalWorkHours,
//       });
//     }

//     // ======================================================
//     // 16. NẾU CÓ THAY ĐỔI
//     // ĐƯA KỲ VỀ OPEN
//     // ======================================================

//     if (createdCount > 0 || updatedCount > 0) {
//       await period.update(
//         {
//           status: "OPEN",
//         },
//         {
//           transaction,
//         },
//       );
//     }

//     // ======================================================
//     // COMMIT
//     // ======================================================

//     await transaction.commit();

//     // ======================================================
//     // RESPONSE
//     // ======================================================

//     return res.json({
//       success: true,

//       message:
//         `Đồng bộ công thành công. ` +
//         `Thêm mới: ${createdCount}, ` +
//         `cập nhật: ${updatedCount}, ` +
//         `không thay đổi: ${unchangedCount}, ` +
//         `bỏ qua: ${skippedCount}.`,

//       data: {
//         period: {
//           payroll_period_id: period.payroll_period_id,

//           start_date: period.start_date,

//           end_date: period.end_date,

//           full_time_standard_days: fullTimeStandardDays,
//         },

//         rule: {
//           morning: "09:00 - 12:00",

//           afternoon: "13:00 - 17:00",

//           hours_per_day: 7,
//         },

//         created: createdCount,

//         updated: updatedCount,

//         unchanged: unchangedCount,

//         skipped: skippedCount,

//         total: attendanceData.length,

//         employees: result,
//       },
//     });
//   } catch (error) {
//     // ======================================================
//     // ROLLBACK
//     // ======================================================

//     await transaction.rollback();

//     console.error("syncPayrollAttendance:", error);

//     return res.status(500).json({
//       success: false,

//       message: "Không thể đồng bộ dữ liệu chấm công",

//       error: error.message,
//     });
//   }
// };
// ==========================================================
// IMPORT PAYROLL ATTENDANCE
//
// GIỮ API CŨ NẾU CẦN DÙNG,
// NHƯNG standard_work_days KHÔNG CÒN LẤY CHUNG TỪ PERIOD.
// ==========================================================

exports.importPayrollAttendances = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { payroll_period_id, attendances } = req.body;

    if (!payroll_period_id || !Array.isArray(attendances)) {
      await transaction.rollback();

      return res.status(400).json({
        success: false,

        message: "Dữ liệu không hợp lệ",
      });
    }

    const period = await PayrollPeriod.findByPk(payroll_period_id, {
      transaction,
    });

    if (!period) {
      await transaction.rollback();

      return res.status(404).json({
        success: false,

        message: "Không tìm thấy kỳ lương",
      });
    }

    if (["PUBLISHED", "CLOSED"].includes(period.status)) {
      await transaction.rollback();

      return res.status(400).json({
        success: false,

        message: "Kỳ lương đã khóa",
      });
    }

    const fullTimeStandardDays = calculateFullTimeStandardDays(
      period.start_date,
      period.end_date,
    );

    const result = [];

    for (const item of attendances) {
      const userId = Number(item.user_id);

      const salaryConfig = await getActiveSalaryConfig(
        userId,
        period.end_date,
        transaction,
      );

      if (!salaryConfig) {
        continue;
      }

      const employeeType = String(salaryConfig.employee_type || "")
        .trim()
        .toUpperCase();

      const standardWorkDays = resolveStandardWorkDays({
        employeeType,

        fullTimeStandardDays,
      });

      if (standardWorkDays === null) {
        continue;
      }

      const newDays = Number(item.attendance_work_days || 0);

      const [attendance, created] = await PayrollAttendance.findOrCreate({
        where: {
          payroll_period_id,

          user_id: userId,
        },

        defaults: {
          standard_work_days: standardWorkDays,

          attendance_work_days: newDays,

          adjustment_work_days: 0,

          confirmed_work_days: newDays,

          attendance_version: 1,

          status: "DRAFT",

          created_at: new Date(),
        },

        transaction,
      });

      if (!created) {
        const oldDays = Number(attendance.attendance_work_days || 0);

        const oldStandard = Number(attendance.standard_work_days || 0);

        if (oldDays !== newDays || oldStandard !== standardWorkDays) {
          const newVersion = Number(attendance.attendance_version || 0) + 1;

          const adjustment = Number(attendance.adjustment_work_days || 0);

          await attendance.update(
            {
              standard_work_days: standardWorkDays,

              attendance_work_days: newDays,

              confirmed_work_days: newDays + adjustment,

              attendance_version: newVersion,

              status: attendance.status === "DRAFT" ? "DRAFT" : "CHANGED",

              confirmed_by:
                attendance.status === "DRAFT" ? attendance.confirmed_by : null,

              confirmed_at:
                attendance.status === "DRAFT" ? attendance.confirmed_at : null,

              updated_at: new Date(),
            },
            {
              transaction,
            },
          );

          await EmployeePayroll.update(
            {
              status: "OUTDATED",

              updated_at: new Date(),
            },
            {
              where: {
                payroll_period_id,

                user_id: userId,
              },

              transaction,
            },
          );
        }
      }

      result.push(attendance);
    }

    await transaction.commit();

    return res.json({
      success: true,

      message: "Nạp dữ liệu công thành công",

      data: result,
    });
  } catch (error) {
    await transaction.rollback();

    console.error("importPayrollAttendances:", error);

    return res.status(500).json({
      success: false,

      message: "Không thể nạp ngày công",

      error: error.message,
    });
  }
};

// ==========================================================
// ĐIỀU CHỈNH CÔNG
// ==========================================================

exports.adjustAttendance = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;

    const {
      adjustment_type,
      adjustment_value,

      adjustment_date,
      reason,
    } = req.body;

    if (!["ADD", "DEDUCT"].includes(adjustment_type)) {
      await transaction.rollback();

      return res.status(400).json({
        success: false,

        message: "adjustment_type phải là ADD hoặc DEDUCT",
      });
    }

    if (Number(adjustment_value) <= 0) {
      await transaction.rollback();

      return res.status(400).json({
        success: false,

        message: "Số công điều chỉnh phải lớn hơn 0",
      });
    }

    if (!reason) {
      await transaction.rollback();

      return res.status(400).json({
        success: false,

        message: "Phải nhập lý do điều chỉnh công",
      });
    }

    const attendance = await PayrollAttendance.findByPk(id, {
      transaction,

      lock: transaction.LOCK.UPDATE,
    });

    if (!attendance) {
      await transaction.rollback();

      return res.status(404).json({
        success: false,

        message: "Không tìm thấy dữ liệu công",
      });
    }

    const period = await PayrollPeriod.findByPk(attendance.payroll_period_id, {
      transaction,
    });

    if (period.status === "CLOSED") {
      await transaction.rollback();

      return res.status(400).json({
        success: false,

        message: "Kỳ lương đã đóng hoàn toàn",
      });
    }

    const value = Number(adjustment_value);

    const signedValue = adjustment_type === "ADD" ? value : -value;

    await PayrollAttendanceAdjustment.create(
      {
        payroll_attendance_id: attendance.payroll_attendance_id,

        user_id: attendance.user_id,

        adjustment_value: value,

        adjustment_type,

        adjustment_date: adjustment_date || null,

        reason,

        created_by: req.user?.user_id || null,

        created_at: new Date(),

        status: 1,
      },
      {
        transaction,
      },
    );

    const newAdjustment =
      Number(attendance.adjustment_work_days || 0) + signedValue;

    const newConfirmed =
      Number(attendance.attendance_work_days || 0) + newAdjustment;

    if (newConfirmed < 0) {
      await transaction.rollback();

      return res.status(400).json({
        success: false,

        message: "Công tính lương không thể nhỏ hơn 0",
      });
    }

    const newVersion = Number(attendance.attendance_version || 0) + 1;

    await attendance.update(
      {
        adjustment_work_days: newAdjustment,

        confirmed_work_days: newConfirmed,

        attendance_version: newVersion,

        status: "CHANGED",

        confirmed_by: null,

        confirmed_at: null,

        updated_at: new Date(),
      },
      {
        transaction,
      },
    );

    // ======================================================
    // PAYROLL OUTDATED
    // ======================================================

    await EmployeePayroll.update(
      {
        status: "OUTDATED",

        updated_at: new Date(),
      },
      {
        where: {
          payroll_period_id: attendance.payroll_period_id,

          user_id: attendance.user_id,
        },

        transaction,
      },
    );

    // ======================================================
    // PERIOD VỀ OPEN
    // ======================================================

    if (period.status !== "OPEN") {
      await period.update(
        {
          status: "OPEN",
        },
        {
          transaction,
        },
      );
    }

    // ======================================================
    // LOG
    // ======================================================

    await PayrollLog.create(
      {
        payroll_period_id: attendance.payroll_period_id,

        user_id: attendance.user_id,

        action: "ADJUST_ATTENDANCE",

        new_data: {
          adjustment_type,

          adjustment_value: value,

          attendance_version: newVersion,

          confirmed_work_days: newConfirmed,
        },

        description: reason,

        created_by: req.user?.user_id || null,
      },
      {
        transaction,
      },
    );

    await transaction.commit();

    return res.json({
      success: true,

      message: "Điều chỉnh công thành công",

      data: attendance,
    });
  } catch (error) {
    await transaction.rollback();

    console.error("adjustAttendance:", error);

    return res.status(500).json({
      success: false,

      message: "Không thể điều chỉnh công",

      error: error.message,
    });
  }
};

// ==========================================================
// XÁC NHẬN MỘT NHÂN VIÊN
// ==========================================================

exports.confirmAttendance = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;

    const attendance = await PayrollAttendance.findByPk(id, {
      transaction,
    });

    if (!attendance) {
      await transaction.rollback();

      return res.status(404).json({
        success: false,

        message: "Không tìm thấy dữ liệu công",
      });
    }

    await attendance.update(
      {
        status: "CONFIRMED",

        confirmed_by: req.user?.user_id || null,

        confirmed_at: new Date(),

        updated_at: new Date(),
      },
      {
        transaction,
      },
    );

    await PayrollLog.create(
      {
        payroll_period_id: attendance.payroll_period_id,

        user_id: attendance.user_id,

        action: "CONFIRM_ATTENDANCE",

        new_data: {
          work_days: attendance.confirmed_work_days,

          version: attendance.attendance_version,
        },

        created_by: req.user?.user_id || null,
      },
      {
        transaction,
      },
    );

    await transaction.commit();

    return res.json({
      success: true,

      message: "Xác nhận công thành công",

      data: attendance,
    });
  } catch (error) {
    await transaction.rollback();

    console.error("confirmAttendance:", error);

    return res.status(500).json({
      success: false,

      message: "Không thể xác nhận công",

      error: error.message,
    });
  }
};

// ==========================================================
// XÁC NHẬN TOÀN BỘ
// ==========================================================

exports.confirmAllAttendance = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { payroll_period_id } = req.body;

    if (!payroll_period_id) {
      await transaction.rollback();

      return res.status(400).json({
        success: false,

        message: "Thiếu payroll_period_id",
      });
    }

    const period = await PayrollPeriod.findByPk(payroll_period_id, {
      transaction,
    });

    if (!period) {
      await transaction.rollback();

      return res.status(404).json({
        success: false,

        message: "Không tìm thấy kỳ lương",
      });
    }

    if (["PUBLISHED", "CLOSED"].includes(period.status)) {
      await transaction.rollback();

      return res.status(400).json({
        success: false,

        message: "Kỳ lương đã khóa",
      });
    }

    const attendances = await PayrollAttendance.findAll({
      where: {
        payroll_period_id,
      },

      transaction,
    });

    if (attendances.length === 0) {
      await transaction.rollback();

      return res.status(400).json({
        success: false,

        message: "Kỳ lương chưa có dữ liệu công",
      });
    }

    await PayrollAttendance.update(
      {
        status: "CONFIRMED",

        confirmed_by: req.user?.user_id || null,

        confirmed_at: new Date(),

        updated_at: new Date(),
      },
      {
        where: {
          payroll_period_id,
        },

        transaction,
      },
    );

    await PayrollPeriod.update(
      {
        status: "ATTENDANCE_CONFIRMED",
      },
      {
        where: {
          payroll_period_id,
        },

        transaction,
      },
    );

    // ======================================================
    // LOG CHO TỪNG NHÂN VIÊN
    // ======================================================

    for (const attendance of attendances) {
      await PayrollLog.create(
        {
          payroll_period_id,

          user_id: attendance.user_id,

          action: "CONFIRM_ATTENDANCE",

          new_data: {
            work_days: attendance.confirmed_work_days,

            version: attendance.attendance_version,
          },

          description: "Xác nhận công toàn bộ kỳ lương",

          created_by: req.user?.user_id || null,
        },
        {
          transaction,
        },
      );
    }

    await transaction.commit();

    return res.json({
      success: true,

      message: "Đã xác nhận toàn bộ công",
    });
  } catch (error) {
    await transaction.rollback();

    console.error("confirmAllAttendance:", error);

    return res.status(500).json({
      success: false,

      message: "Không thể xác nhận toàn bộ công",

      error: error.message,
    });
  }
};
