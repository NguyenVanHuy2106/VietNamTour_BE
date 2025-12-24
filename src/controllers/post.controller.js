// const Post = require("../models/posts.model");
// const PostTag = require("../models/postsTag.model");
// const Tag = require("../models/tags.model");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/user.model");
const db = require("../models");
const { Post, Tag, PostTag, Category } = db;

exports.createPost = async (req, res) => {
  // Bắt đầu một transaction để đảm bảo tất cả các thao tác đều thành công
  const transaction = await Post.sequelize.transaction();

  try {
    const {
      title,
      slug,
      content,
      thumbnail_url,
      description,
      created_by,
      category_id,
      tag_ids, // Giả sử đây là một mảng các ID thẻ
    } = req.body;

    // Kiểm tra các trường bắt buộc
    if (
      !title ||
      !slug ||
      !content ||
      !thumbnail_url ||
      !description ||
      !created_by ||
      !category_id ||
      !tag_ids ||
      tag_ids.length === 0
    ) {
      await transaction.rollback();
      return res.status(400).json({
        message:
          "Vui lòng nhập đầy đủ thông tin bắt buộc và chọn ít nhất một thẻ.",
      });
    }

    // 1. Tạo bài viết mới
    const newPost = await Post.create(
      {
        title,
        slug,
        content,
        thumbnail_url,
        description,
        created_by,
        category_id,
        status: 1, // Mặc định là 1 (hoạt động)
        created_at: new Date(),
      },
      {
        transaction,
      }
    );

    // 2. Kiểm tra các tag_id có tồn tại không
    const tags = await Tag.findAll({
      where: {
        tag_id: tag_ids,
      },
    });

    if (tags.length !== tag_ids.length) {
      await transaction.rollback();
      return res.status(400).json({
        message: "Một hoặc nhiều thẻ không hợp lệ.",
      });
    }

    // 3. Thêm các thẻ vào bài viết (thủ công)
    // Tạo một mảng các đối tượng để chèn vào bảng PostsTag
    const postTagsToCreate = tag_ids.map((tagId) => ({
      post_id: newPost.post_id,
      tag_id: tagId,
    }));

    // Sử dụng PostsTag.bulkCreate để chèn hàng loạt các bản ghi
    await PostTag.bulkCreate(postTagsToCreate, {
      transaction,
    });

    // Commit transaction nếu mọi thứ đều thành công
    await transaction.commit();

    // 4. Gửi response thành công
    return res.status(201).json({
      message: "Thêm bài viết thành công!",
      data: newPost,
    });
  } catch (error) {
    await transaction.rollback();
    console.error(error);
    return res.status(500).json({
      message: "Lỗi server",
      error: error.message,
    });
  }
};

exports.getAllPost = async (req, res) => {
  try {
    const posts = await Post.findAll({
      order: [["post_id", "DESC"]],
      include: [
        {
          model: User,
          as: "creator",
          attributes: ["user_id", "name"],
        },
        {
          model: Tag, // Tên model Tag
          as: "tags", // Alias bạn đã định nghĩa trong models/index.js
          attributes: ["tag_id", "tag_name"], // Các trường bạn muốn lấy từ bảng tag
          through: { attributes: [] }, // Tùy chọn để không lấy các trường từ bảng nối
        },
        {
          model: Category, // Tên model của bảng Category
          as: "category", // Alias cho mối quan hệ này (ví dụ: 'category')
          attributes: ["category_id", "category_name"], // Các trường bạn muốn lấy
        },
      ],
    });

    // Kiểm tra và định dạng lại dữ liệu nếu cần
    const formattedPosts = posts.map((post) => ({
      ...post.toJSON(),
      created_by: post.creator
        ? `${post.creator.user_id} - ${post.creator.name}`
        : "Không xác định",
      tags: post.tags,
      // Thêm tên category trực tiếp vào post và loại bỏ object category
      category_name: post.category ? post.category.category_name : null,
      // Xóa trường category khỏi post.toJSON() nếu cần
      category: undefined, // Dòng này sẽ xóa object category
    }));

    res.status(200).json({
      message: "Lấy danh sách dịch vụ thành công",
      data: formattedPosts,
    });
  } catch (error) {
    res.status(500).json({
      message: "Lỗi server",
      error: error.message,
    });
  }
};
exports.getPostDetail = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Tìm bài viết theo ID và bao gồm category + tag
    const post = await Post.findOne({
      where: { post_id: id },
      include: [
        {
          model: Category,
          as: "category", // đảm bảo đặt đúng alias nếu có
          attributes: ["category_id", "category_name"],
        },
        {
          model: Tag,
          as: "tags", // đảm bảo đã thiết lập quan hệ belongsToMany
          through: { attributes: [] }, // bỏ thông tin trung gian PostsTag
          attributes: ["tag_id", "tag_name"],
        },
        {
          model: User,
          as: "creator",
          attributes: ["user_id", "name"],
        },
      ],
    });

    if (!post) {
      return res.status(404).json({ message: "Bài viết không tồn tại." });
    }

    return res.status(200).json({
      message: "Lấy chi tiết bài viết thành công",
      data: post,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Lỗi server",
      error: error.message,
    });
  }
};

exports.deletePost = async (req, res) => {
  const transaction = await Post.sequelize.transaction();

  try {
    const { post_id } = req.params;

    // Kiểm tra post_id tồn tại không
    const post = await Post.findByPk(post_id);
    if (!post) {
      await transaction.rollback();
      return res.status(404).json({ message: "Bài viết không tồn tại." });
    }

    // 1. Xóa các bản ghi trong bảng PostsTag trước
    await PostTag.destroy({
      where: { post_id },
      transaction,
    });

    // 2. Xóa bài viết
    await Post.destroy({
      where: { post_id },
      transaction,
    });

    await transaction.commit();

    return res.status(200).json({ message: "Xóa bài viết thành công!" });
  } catch (error) {
    await transaction.rollback();
    console.error(error);
    return res.status(500).json({
      message: "Lỗi server khi xóa bài viết.",
      error: error.message,
    });
  }
};

exports.getRelationPost = async (req, res) => {
  try {
    const { Op } = require("sequelize");
    const { post_id, category_id } = req.body;
    if (post_id == null || category_id == null) {
      return res.status(400).json({
        message: "Thiếu post_id hoặc category_id",
      });
    }

    const posts = await Post.findAll({
      where: {
        category_id,
        post_id: { [Op.ne]: post_id }, // loại bỏ tour có tourid đang xét
      },
      order: [["post_id", "DESC"]],
      include: [
        {
          model: User,
          as: "creator",
          attributes: ["user_id", "name"],
        },
        {
          model: Tag, // Tên model Tag
          as: "tags", // Alias bạn đã định nghĩa trong models/index.js
          attributes: ["tag_id", "tag_name"], // Các trường bạn muốn lấy từ bảng tag
          through: { attributes: [] }, // Tùy chọn để không lấy các trường từ bảng nối
        },
        {
          model: Category, // Tên model của bảng Category
          as: "category", // Alias cho mối quan hệ này (ví dụ: 'category')
          attributes: ["category_id", "category_name"], // Các trường bạn muốn lấy
        },
      ],
    });

    // Kiểm tra và định dạng lại dữ liệu nếu cần
    const formattedPosts = posts.map((post) => ({
      ...post.toJSON(),
      created_by: post.creator
        ? `${post.creator.user_id} - ${post.creator.name}`
        : "Không xác định",
      tags: post.tags,
      // Thêm tên category trực tiếp vào post và loại bỏ object category
      category_name: post.category ? post.category.category_name : null,
      // Xóa trường category khỏi post.toJSON() nếu cần
      category: undefined, // Dòng này sẽ xóa object category
      content: undefined,
    }));

    res.status(200).json({
      message: "Lấy danh sách dịch vụ thành công",
      data: formattedPosts,
    });
  } catch (error) {
    res.status(500).json({
      message: "Lỗi server",
      error: error.message,
    });
  }
};
// Huy cmt thêm nè
exports.searchPost = async (req, res) => {
  try {
    const { category_id } = req.body;
    const { Op } = require("sequelize");
    let whereClause = {};
    if (Array.isArray(category_id)) {
      whereClause.category_id = {
        [Op.in]: category_id, // ví dụ: [1, 2]
      };
    } else if (category_id !== undefined) {
      whereClause.category_id = category_id; // ví dụ: 1
    }
    const posts = await Post.findAll({
      where: whereClause,
      order: [["post_id", "DESC"]],
      include: [
        {
          model: User,
          as: "creator",
          attributes: ["user_id", "name"],
        },
        {
          model: Tag, // Tên model Tag
          as: "tags", // Alias bạn đã định nghĩa trong models/index.js
          attributes: ["tag_id", "tag_name"], // Các trường bạn muốn lấy từ bảng tag
          through: { attributes: [] }, // Tùy chọn để không lấy các trường từ bảng nối
        },
        {
          model: Category, // Tên model của bảng Category
          as: "category", // Alias cho mối quan hệ này (ví dụ: 'category')
          attributes: ["category_id", "category_name"], // Các trường bạn muốn lấy
        },
      ],
    });

    // Kiểm tra và định dạng lại dữ liệu nếu cần
    const formattedPosts = posts.map((post) => ({
      ...post.toJSON(),
      created_by: post.creator
        ? `${post.creator.user_id} - ${post.creator.name}`
        : "Không xác định",
      tags: post.tags,
      // Thêm tên category trực tiếp vào post và loại bỏ object category
      category_name: post.category ? post.category.category_name : null,
      // Xóa trường category khỏi post.toJSON() nếu cần
      category: undefined, // Dòng này sẽ xóa object category
    }));

    res.status(200).json({
      message: "Lấy danh sách dịch vụ thành công",
      data: formattedPosts,
    });
  } catch (error) {
    res.status(500).json({
      message: "Lỗi server",
      error: error.message,
    });
  }
};
