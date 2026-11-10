const { S3Client } = require("@aws-sdk/client-s3");

const r2Client = new S3Client({
  region: "auto",
  bucket: "uploads",
  endpoint: "https://0228e87750d83cdb13f72b6d162a3de4.r2.cloudflarestorage.com",
  forcePathStyle: true,
  credentials: {
    accessKeyId: "0f8cf3cc490d1458bb40d7a428a29571",
    secretAccessKey:
      "e8227e51b32b217f3b717d06870851a52bcac969ba7a014d5c8593a6525fd209",
  },
});

module.exports = r2Client;
