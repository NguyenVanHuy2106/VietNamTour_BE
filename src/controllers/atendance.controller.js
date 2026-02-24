const { Attendance, Config, User } = require("../models");
const { Op } = require("sequelize"); // Nhớ import Op để dùng toán tử so sánh

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

    // --- BƯỚC 3 & 4: XỬ LÝ IP (HỖ TRỢ SONG SONG IPV4 VÀ IPV6) ---
    let clientIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

    // Chuẩn hóa IP (Xử lý tiền tố IPv6 lai IPv4 ::ffff:)
    if (clientIp.includes("::ffff:")) {
      clientIp = clientIp.split(":").pop();
    }

    // 1. Lấy đồng thời cả 2 cấu hình từ Database
    const [configV6, configV4] = await Promise.all([
      Config.findByPk("OFFICE_IP"),
      Config.findByPk("IP_V4"),
    ]);

    // 2. Gộp danh sách IP hợp lệ từ cả 2 key
    let validIps = [];

    if (configV6 && configV6.configValue) {
      validIps = validIps.concat(
        configV6.configValue.split(",").map((ip) => ip.trim()),
      );
    }
    if (configV4 && configV4.configValue) {
      validIps = validIps.concat(
        configV4.configValue.split(",").map((ip) => ip.trim()),
      );
    }

    // Dự phòng (Fallback) nếu DB trống - dùng chính các IP bạn đã cung cấp
    if (validIps.length === 0) {
      validIps = ["113.173.242.173", "2001:ee0:4fcf:8510:6dd7:2e:ebc:8ffc"];
    }

    const isLocal =
      clientIp === "::1" || clientIp === "127.0.0.1" || clientIp === "::";

    // 3. Kiểm tra: Chỉ cần khớp 1 trong các IP trong danh sách tổng là OK
    if (!isLocal && !validIps.includes(clientIp)) {
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
