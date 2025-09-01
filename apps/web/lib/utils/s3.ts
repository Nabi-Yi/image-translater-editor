import { PutObjectCommand, S3 } from "@aws-sdk/client-s3";
const bucketName = process.env.AWS_BUCKET_NAME;
const CDN_HOST = process.env.NEXT_PUBLIC_CDN_HOST;
const s3 = new S3();
export async function putImageToS3(imageBuffer: Buffer, contentType: string, key: string[]) {
  const extension = contentType.split("/")[1];
  const keyString = key.join("/") + "." + extension;

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: keyString,
    Body: imageBuffer,
    ContentType: contentType,
  });
  await s3.send(command);
  const publicUrl = `${CDN_HOST}/${keyString}`;
  return publicUrl;
}

export async function getImageFromUrl(url: string) {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
