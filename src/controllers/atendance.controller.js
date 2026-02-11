const { Attendance, Config, User } = require("../models");
const { Op } = require("sequelize"); // Nhớ import Op để dùng toán tử so sánh

exports.submitAttendance = async (req, res) => {
  try {
    // 1. Lấy dữ liệu từ Body và Token
    const { user_id, deviceId } = req.body;

    // Thử lấy ID từ token (Hỗ trợ cả 2 cách đặt tên biến để tránh undefined)
    const idFromToken = req.user.user_id || req.user.id;

    // 2. Bảo mật: Đối soát ID gửi lên và ID trong Token
    if (!idFromToken || user_id != idFromToken) {
      return res.status(403).json({
        success: false,
        message: "Dữ liệu định danh không khớp! Vui lòng đăng nhập lại.",
      });
    }

    // 3. Xử lý IP (Hỗ trợ cả Localhost ::1 và IP thật)
    let clientIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    if (clientIp.includes("::ffff:")) clientIp = clientIp.split(":").pop();

    // 4. Lấy IP văn phòng từ DB
    const officeIpConfig = await Config.findByPk("OFFICE_IP");
    const validIp = officeIpConfig
      ? officeIpConfig.configValue
      : "113.173.242.173";

    const isLocal = clientIp === "::1" || clientIp === "127.0.0.1";

    if (!isLocal && clientIp !== validIp) {
      return res.status(403).json({
        success: false,
        message: `Sai mạng WiFi! (IP: ${clientIp}). Vui lòng dùng WiFi văn phòng Việt Nam Tour.`,
      });
    }

    // 5. Kiểm tra thiết bị (Chống chấm công hộ)
    const user = await User.findByPk(user_id);
    if (!user)
      return res.status(404).json({ message: "Nhân viên không tồn tại." });

    // ADMIN thì có thể bỏ qua check máy, STAFF thì bắt buộc check deviceId
    if (user.role !== "ADMIN") {
      if (!user.device_id) {
        await user.update({ device_id: deviceId }); // Lưu máy lần đầu
      } else if (user.device_id !== deviceId) {
        return res.status(403).json({
          success: false,
          message: "Bạn đang dùng thiết bị khác máy đã đăng ký!",
        });
      }
    }

    // 6. Logic CHỈ CHECK-IN (Một lần duy nhất mỗi ngày)
    const today = new Date().toISOString().split("T")[0];
    const now = new Date();
    const deadline = new Date(now);
    deadline.setHours(9, 0, 0, 0);

    const attendanceStatus = now > deadline ? "LATE" : "ON_TIME";

    // Tìm xem hôm nay nhân viên này đã chấm công chưa
    let record = await Attendance.findOne({
      where: { userId: user_id, workDate: today },
    });

    if (record) {
      // ĐÃ CÓ BẢN GHI -> CHẶN LẠI
      return res.status(400).json({
        success: false,
        message: `Hôm nay bạn đã chấm công rồi! (Lúc: ${new Date(record.checkIn).toLocaleTimeString("vi-VN")})`,
      });
    }

    // CHƯA CÓ BẢN GHI -> TẠO MỚI (CHECK-IN)
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
      message: "Check-in thành công! Chúc bạn ngày mới tốt lành.",
      data: record,
    });
  } catch (error) {
    console.error("Lỗi Controller:", error);
    res.status(500).json({ success: false, message: "Lỗi hệ thống Backend." });
  }
};

exports.getUserAttendance = async (req, res) => {
  try {
    // 1. Lấy dữ liệu từ Body (Vì Huy dùng POST)
    const { userId, month, year } = req.body;

    // 2. Bảo mật: Đối soát ID gửi lên và ID trong Token
    const idFromToken = req.user.user_id || req.user.id;
    if (!idFromToken || userId != idFromToken) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền xem lịch sử của người khác!",
      });
    }

    // 3. Xử lý thời gian: Mặc định là tháng/năm hiện tại nếu không truyền
    const now = new Date();
    const targetMonth = month || now.getMonth() + 1; // 1 - 12
    const targetYear = year || now.getFullYear();

    // Tính ngày đầu tháng và cuối tháng
    const startDate = new Date(targetYear, targetMonth - 1, 1);
    const endDate = new Date(targetYear, targetMonth, 0); // Mẹo lấy ngày cuối tháng

    // 4. Truy vấn lọc theo User và Khoảng ngày trong tháng
    const history = await Attendance.findAll({
      where: {
        userId: userId,
        workDate: {
          [Op.between]: [
            startDate.toISOString().split("T")[0],
            endDate.toISOString().split("T")[0],
          ],
        },
      },
      order: [["workDate", "DESC"]], // Ngày mới nhất lên đầu
    });

    return res.status(200).json({
      success: true,
      message: `Lấy lịch sử tháng ${targetMonth}/${targetYear} thành công.`,
      data: history,
    });
  } catch (error) {
    console.error("Lỗi lấy lịch sử:", error);
    res.status(500).json({ success: false, message: "Lỗi hệ thống Backend." });
  }
};
