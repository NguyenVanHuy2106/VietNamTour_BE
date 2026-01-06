const Tour = require("../models/tours/tour.model");
const TourPrice = require("../models/tours/tourPrice.model");
const TourQuantity = require("../models/tours/tourQuantity.model");
const TourDetail = require("../models/tours/tourDetail.model");
const TourImage = require("../models/tours/tourImage.model");
const TourHighlight = require("../models/tours/tour.highlight");

const Province = require("../models/province.model");
const TravelLocation = require("../models/travelLocation.model");
const TimeType = require("../models/timeType.model");
const VehicleType = require("../models/vehicleType.model");
const HotelType = require("../models/hotelType.model");

const createTour = async (req, res) => {
  const t = await Tour.sequelize.transaction(); // mở transaction
  try {
    const {
      tourname,
      slug,
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
      highlights = [],
      isGroup,
    } = req.body;
    // console.log(highlights);
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
        tourtype: isGroup ? "DOAN" : "",
        slug,
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
      // 2.3 Tạo số lượng tour nếu có dữ liệu
      Object.keys(quantity).length > 0
        ? TourQuantity.create(
            {
              tourid,
              ...quantity,
              created_by,
              created_at: new Date(),
            },
            { transaction: t }
          )
        : Promise.resolve(),

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

      //Thêm hightlight
      highlights.length > 0
        ? TourHighlight.bulkCreate(
            highlights.map((h) => ({
              tourid,
              highlight_key: h.highlight_key,
              highlight_value: h.highlight_value,
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
      tourHighlight,
    ] = await Promise.all([
      TourDetail.findOne({ where: { tourid } }),
      TourPrice.findOne({ where: { tourid } }),
      TourQuantity.findOne({ where: { tourid } }),
      TourImage.findAll({ where: { tourid } }),
      TravelLocation.findByPk(tour.destination),
      Province.findByPk(tour.departure),
      TimeType.findByPk(tour.timetypeid),
      VehicleType.findByPk(tour.vehicletypeid),
      HotelType.findByPk(tour.hoteltypeid),
      TourHighlight.findAll({ where: { tourid } }),
    ]);

    // 3. Gộp và trả về
    //console.log(images);
    return res.status(200).json({
      success: true,
      data: {
        tour,
        detail,
        price,
        quantity,
        images,
        destination_name: destinationProvince?.travellocationname || "",
        departure_name: departureProvince?.provincename || "",
        timetype_name: timeType?.timetypename || "",
        vehicletype_name: vehicleType?.vehicletypename || "",
        hoteltypename: hotelType?.hoteltypename || "",
        highlights: tourHighlight,
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
          TravelLocation.findByPk(tour.destination),
          Province.findByPk(tour.departure),
          TimeType.findByPk(tour.timetypeid),
          VehicleType.findByPk(tour.vehicletypeid),
          HotelType.findByPk(tour.hoteltypeid), // Lấy thông tin hoteltypename
        ]);

        return {
          ...tour.toJSON(),
          destination_name: destinationProvince?.travellocationname || "",
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
const get8NewTours = async (req, res) => {
  // console.log("Huy");
  try {
    const tours = await Tour.findAll({
      where: {
        tourtype: "", // chỉ lấy tour không phải khách đoàn
      },
      order: [["created_at", "DESC"]], // Sắp xếp theo thời gian tạo mới nhất
      limit: 8, // Lấy 8 tour mới nhất
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
          TravelLocation.findByPk(tour.destination),
          Province.findByPk(tour.departure),
          TimeType.findByPk(tour.timetypeid),
          VehicleType.findByPk(tour.vehicletypeid),
          HotelType.findByPk(tour.hoteltypeid), // Lấy thông tin hoteltypename
        ]);

        return {
          ...tour.toJSON(),
          destination_name: destinationProvince?.travellocationname || "",
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
const getDOANTours = async (req, res) => {
  // console.log("Huy");
  try {
    const tours = await Tour.findAll({
      where: {
        tourtype: "DOAN", // chỉ lấy tour không phải khách đoàn
      },
      order: [["created_at", "DESC"]], // Sắp xếp theo thời gian tạo mới nhất
      limit: 8, // Lấy 8 tour mới nhất
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
          TravelLocation.findByPk(tour.destination),
          Province.findByPk(tour.departure),
          TimeType.findByPk(tour.timetypeid),
          VehicleType.findByPk(tour.vehicletypeid),
          HotelType.findByPk(tour.hoteltypeid), // Lấy thông tin hoteltypename
        ]);

        return {
          ...tour.toJSON(),
          destination_name: destinationProvince?.travellocationname || "",
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
      tourid, // bắt buộc
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
      images = [],
      detailContent = "",
      price = {},
      quantity = {},
      highlights = [],
      isGroup,
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
        hoteltypeid,
        tourtype: isGroup ? "DOAN" : "",
        updated_by,
        updated_at: new Date(),
      },
      { where: { tourid }, transaction: t }
    );

    // 2. Xóa toàn bộ bảng phụ liên quan
    await Promise.all([
      TourDetail.destroy({ where: { tourid }, transaction: t }),
      TourPrice.destroy({ where: { tourid }, transaction: t }),
      TourQuantity.destroy({ where: { tourid }, transaction: t }),
      TourImage.destroy({ where: { tourid }, transaction: t }),
      TourHighlight.destroy({ where: { tourid }, transaction: t }),
    ]);

    // 3. Tạo lại dữ liệu phụ
    await Promise.all([
      // 3.1 Chi tiết tour
      TourDetail.create(
        {
          tourid,
          content: detailContent,
          created_by: updated_by,
          created_at: new Date(),
        },
        { transaction: t }
      ),

      // 3.2 Giá tour
      TourPrice.create(
        {
          tourid,
          ...price,
          created_by: updated_by,
          created_at: new Date(),
        },
        { transaction: t }
      ),

      // 3.3 Số lượng tour (nếu có)
      Object.keys(quantity).length > 0
        ? TourQuantity.create(
            {
              tourid,
              ...quantity,
              created_by: updated_by,
              created_at: new Date(),
            },
            { transaction: t }
          )
        : Promise.resolve(),

      // 3.4 Ảnh (nếu có)
      images.length > 0
        ? TourImage.bulkCreate(
            images.map((img) => ({
              tourid,
              imagename: img.imagename || "",
              imageurl: img.imageurl,
              imagetype: img.imagetype || 0,
              created_by: updated_by,
              created_at: new Date(),
            })),
            { transaction: t }
          )
        : Promise.resolve(),

      // 3.5 Highlight (nếu có)
      highlights.length > 0
        ? TourHighlight.bulkCreate(
            highlights.map((h) => ({
              tourid,
              highlight_key: h.highlight_key,
              highlight_value: h.highlight_value,
            })),
            { transaction: t }
          )
        : Promise.resolve(),
    ]);

    await t.commit();
    res
      .status(200)
      .json({ success: true, message: "Tour updated successfully" });
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

const deleteTour = async (req, res) => {
  const t = await Tour.sequelize.transaction(); // Mở transaction
  try {
    const { tourid } = req.params; // Lấy tourid từ URL params

    // 1. Tạo mảng các promise để xóa dữ liệu song song
    const deletePromises = [
      // Xóa các hình ảnh liên quan đến tour
      TourImage.destroy({
        where: { tourid },
        transaction: t,
      }),
      TourHighlight.destroy({
        where: { tourid },
        transaction: t,
      }),

      // Xóa số lượng tour
      TourQuantity.destroy({
        where: { tourid },
        transaction: t,
      }),

      // Xóa giá tour
      TourPrice.destroy({
        where: { tourid },
        transaction: t,
      }),

      // Xóa chi tiết tour
      TourDetail.destroy({
        where: { tourid },
        transaction: t,
      }),

      // Xóa tour chính
      Tour.destroy({
        where: { tourid },
        transaction: t,
      }),
    ];

    // 2. Thực hiện tất cả các promise song song
    await Promise.all(deletePromises);

    // 3. Commit transaction nếu tất cả đều thành công
    await t.commit();

    res
      .status(200)
      .json({ success: true, message: "Tour deleted successfully" });
  } catch (error) {
    await t.rollback(); // Rollback nếu có lỗi
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to delete tour",
      error: error.message,
    });
  }
};
const searchTour = async (req, res) => {
  try {
    const {
      tourtype,
      timetypeid,
      hoteltypeid,
      vehicletypeid,
      departure,
      destination,
    } = req.body;
    const { Op } = require("sequelize");
    let whereClause = {};
    // Xử lý tourtype
    if (Array.isArray(tourtype)) {
      whereClause.tourtype = {
        [Op.in]: tourtype, // ["DOAN", ""] hoặc ["DOAN"] hoặc [""]
      };
    } else if (tourtype !== undefined) {
      whereClause.tourtype = tourtype; // "DOAN" hoặc ""
    }

    // Xử lý timetypeid
    if (Array.isArray(timetypeid)) {
      whereClause.timetypeid = {
        [Op.in]: timetypeid, // ví dụ: [1, 2]
      };
    } else if (timetypeid !== undefined) {
      whereClause.timetypeid = timetypeid; // ví dụ: 1
    }

    //Xử lý hoteltypeid
    if (Array.isArray(hoteltypeid)) {
      whereClause.hoteltypeid = {
        [Op.in]: hoteltypeid, // ví dụ: [1, 2]
      };
    } else if (hoteltypeid !== undefined) {
      whereClause.hoteltypeid = hoteltypeid; // ví dụ: 1
    }

    //Xử lý vehicletypeid
    if (Array.isArray(vehicletypeid)) {
      whereClause.vehicletypeid = {
        [Op.in]: vehicletypeid, // ví dụ: [1, 2]
      };
    } else if (vehicletypeid !== undefined) {
      whereClause.vehicletypeid = vehicletypeid; // ví dụ: 1
    }

    //Xử lý deparrture
    if (Array.isArray(departure)) {
      whereClause.departure = {
        [Op.in]: departure, // ví dụ: [1, 2]
      };
    } else if (departure !== undefined) {
      whereClause.departure = departure; // ví dụ: 1
    }

    //Xử lý destination
    if (Array.isArray(destination)) {
      whereClause.destination = {
        [Op.in]: destination, // ví dụ: [1, 2]
      };
    } else if (destination !== undefined) {
      whereClause.destination = destination; // ví dụ: 1
    }

    const tours = await Tour.findAll({
      where: whereClause,
      order: [["tourid", "DESC"]],
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
          TravelLocation.findByPk(tour.destination),
          Province.findByPk(tour.departure),
          TimeType.findByPk(tour.timetypeid),
          VehicleType.findByPk(tour.vehicletypeid),
          HotelType.findByPk(tour.hoteltypeid), // Lấy thông tin hoteltypename
        ]);

        return {
          ...tour.toJSON(),
          destination_name: destinationProvince?.travellocationname || "",
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
const getRelationTours = async (req, res) => {
  try {
    const { Op } = require("sequelize");

    const { tourid, destination } = req.body;
    if (tourid == null || destination == null) {
      return res.status(400).json({
        message: "Thiếu tourid hoặc destination",
      });
    }
    const tours = await Tour.findAll({
      where: {
        destination,
        tourid: { [Op.ne]: tourid }, // loại bỏ tour có tourid đang xét
      },
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
          TravelLocation.findByPk(tour.destination),
          Province.findByPk(tour.departure),
          TimeType.findByPk(tour.timetypeid),
          VehicleType.findByPk(tour.vehicletypeid),
          HotelType.findByPk(tour.hoteltypeid), // Lấy thông tin hoteltypename
        ]);

        return {
          ...tour.toJSON(),
          destination_name: destinationProvince?.travellocationname || "",
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
const getTourBySlug = async (req, res) => {
  const { slug } = req.params;

  try {
    // 1. Lấy thông tin tour chính
    //const tour = await Tour.findByPk(tourid);

    const tour = await Tour.findOne({
      where: { slug: slug.trim() },
    });

    if (!tour) {
      return res
        .status(404)
        .json({ success: false, message: "Tour not found" });
    }
    const tourid = tour.tourid;
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
      tourHighlight,
    ] = await Promise.all([
      TourDetail.findOne({ where: { tourid } }),
      TourPrice.findOne({ where: { tourid } }),
      TourQuantity.findOne({ where: { tourid } }),
      TourImage.findAll({ where: { tourid } }),
      TravelLocation.findByPk(tour.destination),
      Province.findByPk(tour.departure),
      TimeType.findByPk(tour.timetypeid),
      VehicleType.findByPk(tour.vehicletypeid),
      HotelType.findByPk(tour.hoteltypeid),
      TourHighlight.findAll({ where: { tourid } }),
    ]);

    // 3. Gộp và trả về
    //console.log(images);
    return res.status(200).json({
      success: true,
      data: {
        tour,
        detail,
        price,
        quantity,
        images,
        destination_name: destinationProvince?.travellocationname || "",
        departure_name: departureProvince?.provincename || "",
        timetype_name: timeType?.timetypename || "",
        vehicletype_name: vehicleType?.vehicletypename || "",
        hoteltypename: hotelType?.hoteltypename || "",
        highlights: tourHighlight,
      },
    });
  } catch (error) {
    //console.error("Error fetching tour by ID:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch tour details",
      error: error.message,
    });
  }
};

module.exports = {
  createTour,
  getTourById,
  getAllTours,
  updateTour,
  deleteTour,
  get8NewTours,
  getDOANTours,
  searchTour,
  getRelationTours,
  getTourBySlug,
};
