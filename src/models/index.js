// File: models/index.js (hoặc file bạn dùng để thiết lập associations)

const Post = require("./posts.model");
const Tag = require("./tags.model");
const PostTag = require("./postsTag.model");

const Category = require("./categories.model");

// Một bài viết có nhiều tags, thông qua bảng trung gian PostTag
Post.belongsToMany(Tag, {
  through: PostTag,
  foreignKey: "post_id",
  otherKey: "tag_id",
  as: "tags", // Alias bạn sẽ dùng trong include
});

// Một tag cũng có nhiều bài viết, thông qua bảng trung gian PostTag
Tag.belongsToMany(Post, {
  through: PostTag,
  foreignKey: "tag_id",
  otherKey: "post_id",
  as: "posts",
});

Category.hasMany(Post, { foreignKey: "category_id", as: "posts" });
Post.belongsTo(Category, {
  foreignKey: "category_id",
  as: "category",
});

// Xuất các model đã được định nghĩa mối quan hệ
module.exports = { Post, Tag, PostTag, Category };
