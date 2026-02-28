const { Attendance, Config, User } = require("../models");
const { Op, fn, col, projection } = require("sequelize");
exports.submitAttendance = async (req, res) => {
  try {
    const { user_id, deviceId } = req.body;
    const idFromToken = req.user.user_id || req.user.id;

    if (!idFromToken || user_id != idFromToken) {
      return res.status(403).json({
        success: false,
        message: "Dữ liệu định danh không khớp! Vui lòng đăng nhập lại.",
      });
    }

    // --- BƯỚC 3 & 4: XỬ LÝ IP (HỖ TRỢ CẢ IPV4 VÀ DẢI IPV6) ---
    let clientIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

    // Chuẩn hóa IP (Xử lý tiền tố IPv6 lai IPv4 ::ffff:)
    if (clientIp.includes("::ffff:")) {
      clientIp = clientIp.split(":").pop();
    }

    const [configV6, configV4] = await Promise.all([
      Config.findByPk("OFFICE_IP"),
      Config.findByPk("IP_V4"),
    ]);

    let validIps = [];
    if (configV6?.configValue) {
      validIps = validIps.concat(
        configV6.configValue.split(",").map((ip) => ip.trim()),
      );
    }
    if (configV4?.configValue) {
      validIps = validIps.concat(
        configV4.configValue.split(",").map((ip) => ip.trim()),
      );
    }

    if (validIps.length === 0) {
      validIps = ["113.173.242.173", "2001:ee0:4fcf:8510:6dd7:2e:ebc:8ffc"];
    }

    const isLocal =
      clientIp === "::1" || clientIp === "127.0.0.1" || clientIp === "::";

    // --- LOGIC KIỂM TRA THÔNG MINH ---
    const isIpValid = validIps.some((validIp) => {
      // Trường hợp cả 2 đều là IPv6: So sánh 4 nhóm đầu (64-bit prefix)
      if (validIp.includes(":") && clientIp.includes(":")) {
        const validPrefix = validIp.split(":").slice(0, 4).join(":");
        const clientPrefix = clientIp.split(":").slice(0, 4).join(":");
        return validPrefix === clientPrefix;
      }
      // Trường hợp IPv4: So khớp chính xác
      return validIp === clientIp;
    });

    if (!isLocal && !isIpValid) {
      return res.status(403).json({
        success: false,
        message: `Sai mạng WiFi! (Hệ thống nhận diện IP: ${clientIp}). Vui lòng dùng WiFi văn phòng Việt Nam Tour.`,
      });
    }

    // --- CÁC BƯỚC CÒN LẠI GIỮ NGUYÊN ---
    const user = await User.findByPk(user_id);
    if (!user)
      return res.status(404).json({ message: "Nhân viên không tồn tại." });

    if (user.role !== "ADMIN") {
      if (!user.device_id) {
        await user.update({ device_id: deviceId });
      } else if (user.device_id !== deviceId) {
        return res.status(403).json({
          success: false,
          message: "Bạn đang dùng thiết bị khác máy đã đăng ký!",
        });
      }
    }

    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const currentTimeVN = now.toLocaleTimeString("en-GB", {
      timeZone: "Asia/Ho_Chi_Minh",
      hour12: false,
    });

    const currentHour = parseInt(currentTimeVN.split(":")[0]);
    const currentMinute = parseInt(currentTimeVN.split(":")[1]);

    const attendanceStatus =
      currentHour > 9 || (currentHour === 9 && currentMinute > 0)
        ? "LATE"
        : "ON_TIME";

    let record = await Attendance.findOne({
      where: { userId: user_id, workDate: today },
    });

    if (record) {
      return res.status(400).json({
        success: false,
        message: `Hôm nay bạn đã chấm công rồi! (Lúc: ${new Date(record.checkIn).toLocaleTimeString("vi-VN")})`,
      });
    }

    record = await Attendance.create({
      userId: user_id,
      workDate: today,
      checkIn: now,
      ipAddress: clientIp,
      deviceIdUsed: deviceId,
      status: attendanceStatus,
    });

    return res.status(200).json({
      success: true,
      message: `Check-in thành công! (${attendanceStatus === "LATE" ? "Bạn đã đi muộn" : "Đúng giờ"})`,
      data: record,
    });
  } catch (error) {
    console.error("Lỗi Controller:", error);
    res.status(500).json({ success: false, message: "Lỗi hệ thống Backend." });
  }
};

exports.getUserAttendance = async (req, res) => {
  try {
    const { userId, month, year } = req.body;
    const idFromToken = req.user.user_id || req.user.id;

    if (!idFromToken || userId != idFromToken) {
      return res
        .status(403)
        .json({ success: false, message: "Không có quyền!" });
    }

    const now = new Date();
    const targetMonth = parseInt(month) || now.getMonth() + 1;
    const targetYear = parseInt(year) || now.getFullYear();

    const startDate = `${targetYear}-${String(targetMonth).padStart(2, "0")}-01 00:00:00`;
    const lastDay = new Date(targetYear, targetMonth, 0).getDate();
    const endDate = `${targetYear}-${String(targetMonth).padStart(2, "0")}-${lastDay} 23:59:59`;

    const history = await Attendance.findAll({
      where: {
        userId: userId,
        workDate: { [Op.between]: [startDate, endDate] },
      },
      attributes: [
        "id",
        "userId",
        "workDate",
        "status",
        "deviceIdUsed",
        "ipAddress",
        // Với Postgres, dùng TO_CHAR thay cho DATE_FORMAT
        // Format 'YYYY-MM-DD"T"HH24:MI:SS' giúp giữ nguyên giờ 10:31:14
        [fn("TO_CHAR", col("check_in"), 'YYYY-MM-DD"T"HH24:MI:SS'), "checkIn"],
        [
          fn("TO_CHAR", col("check_out"), 'YYYY-MM-DD"T"HH24:MI:SS'),
          "checkOut",
        ],
      ],
      order: [["workDate", "DESC"]],
    });

    return res.status(200).json({
      success: true,
      data: history,
    });
  } catch (error) {
    console.error("Lỗi:", error);
    res.status(500).json({ success: false, message: "Lỗi hệ thống." });
  }
};

// Đảm bảo import đúng. Nếu file model export kiểu 'module.exports = Attendance'

exports.getAttendanceHistory = async (req, res) => {
  try {
    let { fromDate, toDate, userId } = req.body;

    // 1. Xử lý mặc định ngày tháng
    if (!fromDate || !toDate) {
      const today = new Date();
      const lastMonth = new Date();
      lastMonth.setDate(today.getDate() - 30);
      fromDate = fromDate || lastMonth.toISOString().split("T")[0];
      toDate = toDate || today.toISOString().split("T")[0];
    }

    const start = `${fromDate} 00:00:00`;
    const end = `${toDate} 23:59:59`;

    // 2. Tạo đối tượng điều kiện WHERE
    const whereConditions = {
      workDate: {
        [Op.between]: [start, end],
      },
    };

    if (userId) {
      whereConditions.userId = userId;
    }

    // 3. Truy vấn kèm theo Include để lấy tên nhân viên
    const history = await Attendance.findAll({
      where: whereConditions,
      attributes: [
        "id",
        "userId",
        "workDate",
        "status",
        "deviceIdUsed",
        "ipAddress",
        [fn("TO_CHAR", col("check_in"), 'YYYY-MM-DD"T"HH24:MI:SS'), "checkIn"],
        [
          fn("TO_CHAR", col("check_out"), 'YYYY-MM-DD"T"HH24:MI:SS'),
          "checkOut",
        ],
      ],
      include: [
        {
          model: User, // Tên model User của bạn
          attributes: ["name"], // Chỉ lấy cột fullName (hoặc 'name' tùy DB của bạn)
          as: "user", // Alias nếu bạn có định nghĩa trong association
        },
      ],
      order: [["workDate", "DESC"]],
    });

    // 4. Format lại data trả về để "fullName" nằm cùng cấp (tùy chọn)
    const formattedData = history.map((item) => {
      const plainItem = item.get({ plain: true });
      return {
        ...plainItem,
        fullName: plainItem.userId ? plainItem.user.name : "N/A", // Đưa fullName ra ngoài cho dễ dùng ở FE
        user: undefined, // Xóa object lồng nhau nếu không cần
      };
    });

    return res.status(200).json({
      success: true,
      message: userId
        ? `Lấy lịch sử chấm công nhân viên ${userId}`
        : "Lấy lịch sử chấm công tất cả nhân viên",
      count: formattedData.length,
      data: formattedData,
    });
  } catch (error) {
    console.error("Lỗi lấy lịch sử chấm công:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi truy xuất dữ liệu!",
    });
  }
};
