const {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} = require('@aws-sdk/client-s3');
const { randomUUID } = require('node:crypto');

const REQUIRED_ENV = ['S3_ENDPOINT', 'S3_REGION', 'S3_ACCESS_KEY', 'S3_SECRET_KEY', 'S3_BUCKET'];

async function main() {
  const missing = REQUIRED_ENV.filter((name) => !process.env[name]?.trim());
  if (missing.length > 0) {
    throw new Error(`Configuration S3 incomplète : ${missing.join(', ')}`);
  }

  const client = new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY,
      secretAccessKey: process.env.S3_SECRET_KEY,
    },
    forcePathStyle: true,
  });
  const bucket = process.env.S3_BUCKET;
  const key = `__storage-healthcheck__/${randomUUID()}.txt`;
  const expectedContent = 'supabase-s3-healthcheck';
  let objectMayExist = false;

  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    console.log('HEAD_BUCKET: OK');

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: expectedContent,
        ContentType: 'text/plain',
      }),
    );
    objectMayExist = true;
    console.log('PUT_OBJECT: OK');

    const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const actualContent = await response.Body.transformToString();
    if (actualContent !== expectedContent) {
      throw new Error('Le contenu téléchargé ne correspond pas au contenu envoyé.');
    }
    console.log('GET_OBJECT: OK');

    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    objectMayExist = false;
    console.log('DELETE_OBJECT: OK');

    try {
      await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
      throw new Error("L'objet existe encore après sa suppression.");
    } catch (error) {
      if (error.message === "L'objet existe encore après sa suppression.") throw error;
      if (error.$metadata?.httpStatusCode !== 404) throw error;
    }
    console.log('DELETE_VERIFIED: OK');
  } finally {
    if (objectMayExist) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
      console.log('CLEANUP: OK');
    }
    client.destroy();
  }
}

main().catch((error) => {
  const status = error.$metadata?.httpStatusCode;
  console.error(`S3_CHECK: FAILED (${error.name || 'Error'}${status ? ` HTTP ${status}` : ''})`);
  process.exitCode = 1;
});
