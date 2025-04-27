const Tour = require("../models/tours/tour.model");
const TourPrice = require("../models/tours/tourPrice.model");
const TourQuantity = require("../models/tours/tourQuantity.model");
const TourDetail = require("../models/tours/tourDetail.model");
const TourImage = require("../models/tours/tourImage.model");

const Province = require("../models/province.model");
const TimeType = require("../models/timeType.model");
const VehicleType = require("../models/vehicleType.model");
const HotelType = require("../models/hotelType.model");

const createTour = async (req, res) => {
  const t = await Tour.sequelize.transaction(); // mở transaction
  try {
    const {
      tourname,
      description,
      destination,
      departure,
      timetypeid,
      hoteltypeid,
      startdate,
      enddate,
      vehicletypeid,
      created_by,
      images = [], // array
      detailContent = "", // string
      price = {}, // object: { adultprice, childprice, freeprice, promotion }
      quantity = {}, // object: { adult, child, free }
    } = req.body;

    // 1. Tạo tour chính
    const newTour = await Tour.create(
      {
        tourname,
        description,
        destination,
        departure,
        timetypeid,
        startdate,
        enddate,
        vehicletypeid,
        created_by,
        created_at: new Date(),
        hoteltypeid,
      },
      { transaction: t }
    );

    const tourid = newTour.tourid;

    // 2. Tạo các bảng phụ song song bằng Promise.all
    await Promise.all([
      // 2.1 Tạo chi tiết tour
      TourDetail.create(
        {
          tourid,
          content: detailContent,
          created_by,
          created_at: new Date(),
        },
        { transaction: t }
      ),

      // 2.2 Tạo giá tour
      TourPrice.create(
        {
          tourid,
          ...price,
          created_by,
          created_at: new Date(),
        },
        { transaction: t }
      ),

      // 2.3 Tạo số lượng tour
      TourQuantity.create(
        {
          tourid,
          ...quantity,
          created_by,
          created_at: new Date(),
        },
        { transaction: t }
      ),

      // 2.4 Thêm hình ảnh nếu có
      images.length > 0
        ? TourImage.bulkCreate(
            images.map((img) => ({
              tourid,
              imagename: img.imagename || "",
              imageurl: img.imageurl,
              imagetype: img.imagetype || 0,
              created_by,
              created_at: new Date(),
            })),
            { transaction: t }
          )
        : Promise.resolve(),
    ]);

    await t.commit(); // lưu transaction
    res
      .status(201)
      .json({ success: true, message: "Tour created successfully", tourid });
  } catch (error) {
    await t.rollback(); // rollback nếu có lỗi
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to create tour",
      error: error.message,
    });
  }
};

const getTourById = async (req, res) => {
  const { tourid } = req.params;

  try {
    // 1. Lấy thông tin tour chính
    const tour = await Tour.findByPk(tourid);

    if (!tour) {
      return res
        .status(404)
        .json({ success: false, message: "Tour not found" });
    }

    // 2. Lấy các bảng liên quan song song
    const [
      detail,
      price,
      quantity,
      images,
      destinationProvince,
      departureProvince,
      timeType,
      vehicleType,
      hotelType,
    ] = await Promise.all([
      TourDetail.findOne({ where: { tourid } }),
      TourPrice.findOne({ where: { tourid } }),
      TourQuantity.findOne({ where: { tourid } }),
      TourImage.findAll({ where: { tourid } }),
      Province.findByPk(tour.destination),
      Province.findByPk(tour.departure),
      TimeType.findByPk(tour.timetypeid),
      VehicleType.findByPk(tour.vehicletypeid),
      HotelType.findByPk(tour.hoteltypeid),
    ]);

    // 3. Gộp và trả về
    return res.status(200).json({
      success: true,
      data: {
        tour,
        detail,
        price,
        quantity,
        images,
        destination_name: destinationProvince?.provincename || "",
        departure_name: departureProvince?.provincename || "",
        timetype_name: timeType?.timetypename || "",
        vehicletype_name: vehicleType?.vehicletypename || "",
        hoteltypename: hotelType?.hoteltypename || "",
      },
    });
  } catch (error) {
    console.error("Error fetching tour by ID:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch tour details",
      error: error.message,
    });
  }
};

const getAllTours = async (req, res) => {
  try {
    const tours = await Tour.findAll({
      order: [["tourid", "DESC"]], // Sắp xếp giảm dần theo tourid
    });

    const tourList = await Promise.all(
      tours.map(async (tour) => {
        const [
          price,
          images,
          destinationProvince,
          departureProvince,
          timeType,
          vehicleType,
          hotelType, // Thêm dòng này
        ] = await Promise.all([
          TourPrice.findOne({ where: { tourid: tour.tourid } }),
          TourImage.findAll({
            where: {
              tourid: tour.tourid,
              imagetype: 0,
            },
          }),
          Province.findByPk(tour.destination),
          Province.findByPk(tour.departure),
          TimeType.findByPk(tour.timetypeid),
          VehicleType.findByPk(tour.vehicletypeid),
          HotelType.findByPk(tour.hoteltypeid), // Lấy thông tin hoteltypename
        ]);

        return {
          ...tour.toJSON(),
          destination_name: destinationProvince?.provincename || "",
          departure_name: departureProvince?.provincename || "",
          timetype_name: timeType?.timetypename || "",
          vehicletype_name: vehicleType?.vehicletypename || "",
          hoteltypename: hotelType?.hoteltypename || "", // Thêm trường này
          price,
          images,
        };
      })
    );

    return res.status(200).json({
      success: true,
      data: tourList,
    });
  } catch (error) {
    console.error("Error fetching tour list:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch tours",
      error: error.message,
    });
  }
};
const updateTour = async (req, res) => {
  const t = await Tour.sequelize.transaction();
  try {
    const {
      tourid,
      tourname,
      description,
      destination,
      departure,
      timetypeid,
      hoteltypeid,
      startdate,
      enddate,
      vehicletypeid,
      updated_by,
      images = [], // array
      detailContent = "", // string
      price = {}, // object: { adultprice, childprice, freeprice, promotion }
      quantity = {}, // object: { adult, child, free }
    } = req.body;

    // 1. Cập nhật tour chính
    await Tour.update(
      {
        tourname,
        description,
        destination,
        departure,
        timetypeid,
        startdate,
        enddate,
        vehicletypeid,
        updated_by,
        updated_at: new Date(),
        hoteltypeid,
      },
      { where: { tourid }, transaction: t }
    );

    // 2. Cập nhật bảng phụ song song
    await Promise.all([
      // 2.1 Cập nhật chi tiết tour
      TourDetail.update(
        {
          content: detailContent,
          updated_by,
          updated_at: new Date(),
        },
        { where: { tourid }, transaction: t }
      ),

      // 2.2 Cập nhật giá tour
      TourPrice.update(
        {
          ...price,
          updated_by,
          updated_at: new Date(),
        },
        { where: { tourid }, transaction: t }
      ),

      // 2.3 Cập nhật số lượng
      TourQuantity.update(
        {
          ...quantity,
          updated_by,
          updated_at: new Date(),
        },
        { where: { tourid }, transaction: t }
      ),

      // 2.4 Cập nhật hình ảnh: xóa cũ, thêm mới
      (async () => {
        // Xoá hình ảnh cũ
        await TourImage.destroy({ where: { tourid }, transaction: t });

        // Thêm hình ảnh mới nếu có
        if (images.length > 0) {
          await TourImage.bulkCreate(
            images.map((img) => ({
              tourid,
              imagename: img.imagename || "",
              imageurl: img.imageurl,
              imagetype: img.imagetype || 0,
              created_by: updated_by,
              created_at: new Date(),
            })),
            { transaction: t }
          );
        }
      })(),
    ]);

    await t.commit();
    res.status(200).json({
      success: true,
      message: "Tour updated successfully",
    });
  } catch (error) {
    await t.rollback();
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to update tour",
      error: error.message,
    });
  }
};

module.exports = { createTour, getTourById, getAllTours, updateTour };
