// ponytail: S3 RustFS storage upload helper (YAGNI)
import { createServerFn } from "@tanstack/react-start";
import { S3Client, PutObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";

export const uploadToRustFS = createServerFn({ method: "POST" })
  .validator((d: { base64Data: string; fileName: string; contentType: string }) => d)
  .handler(async ({ data }) => {
    try {
      const { base64Data, fileName, contentType } = data;

      // Extract environment variables
      const endpoint = process.env.S3_ENDPOINT;
      const accessKeyId = process.env.S3_ACCESS_KEY;
      const secretAccessKey = process.env.S3_SECRET_KEY;
      const bucket = process.env.S3_BUCKET || "chat";
      const region = process.env.S3_REGION || "ap-southeast-1";
      const publicUrl = process.env.S3_PUBLIC_URL;
      const pathStyle = process.env.S3_PATH_STYLE !== "false";

      if (!endpoint || !accessKeyId || !secretAccessKey) {
        throw new Error("RustFS S3 storage credentials are not configured in environmental variables");
      }

      // Initialize S3 client (RustFS/MinIO compatible)
      const s3 = new S3Client({
        endpoint,
        region,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
        forcePathStyle: pathStyle,
      });

      // Decode base64Data
      const base64Body = base64Data.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Body, "base64");

      // Generate unique key
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 8);
      const cleanFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
      const key = `ve-report/${timestamp}-${randomStr}-${cleanFileName}`;

      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType || "application/octet-stream",
      });

      await s3.send(command);

      // Build public URL
      const basePublicUrl = publicUrl || `${endpoint}/${bucket}`;
      const fileUrl = `${basePublicUrl.replace(/\/$/, "")}/${key}`;

      return {
        success: true,
        url: fileUrl,
        key,
      };
    } catch (err: any) {
      console.error("[Upload] RustFS error:", err);
      throw new Error(err.message || "Upload ke RustFS gagal");
    }
  });

export const testRustFSConnection = createServerFn({ method: "POST" })
  .handler(async () => {
    try {
      const endpoint = process.env.S3_ENDPOINT;
      const accessKeyId = process.env.S3_ACCESS_KEY;
      const secretAccessKey = process.env.S3_SECRET_KEY;
      const bucket = process.env.S3_BUCKET || "chat";
      const region = process.env.S3_REGION || "ap-southeast-1";
      const pathStyle = process.env.S3_PATH_STYLE !== "false";

      if (!endpoint || !accessKeyId || !secretAccessKey) {
        throw new Error("Kredensial S3 RustFS belum dikonfigurasi di file env");
      }

      const s3 = new S3Client({
        endpoint,
        region,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
        forcePathStyle: pathStyle,
      });

      const command = new ListObjectsV2Command({
        Bucket: bucket,
        MaxKeys: 1,
      });

      await s3.send(command);

      return {
        success: true,
        message: "Koneksi ke S3 RustFS berhasil! Bucket dan kredensial terhubung.",
      };
    } catch (err: any) {
      console.error("[Test RustFS] failed:", err);
      throw new Error(err.message || "Gagal menghubungi S3 RustFS storage");
    }
  });

export const getRustFSConfig = createServerFn({ method: "GET" }).handler(async () => {
  return {
    provider: process.env.STORAGE_PROVIDER || "RustFS",
    endpoint: process.env.S3_ENDPOINT || "",
    bucket: process.env.S3_BUCKET || "chat",
  };
});export const getProxyImageBase64 = createServerFn({ method: "GET" })
  .validator((url: string) => url)
  .handler(async ({ data: url }) => {
    try {
      // ponytail: proxy image server-side untuk bypass CORS (YAGNI)
      if (!url.startsWith("http")) {
        return { success: false, data: url };
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error("Gagal mengambil gambar dari S3");
      const buffer = await res.arrayBuffer();
      const contentType = res.headers.get("content-type") || "image/png";
      const base64 = Buffer.from(buffer).toString("base64");
      return {
        success: true,
        data: `data:${contentType};base64,${base64}`
      };
    } catch (err: any) {
      console.error("[Proxy Image] error:", err);
      return { success: false, data: url };
    }
  });
