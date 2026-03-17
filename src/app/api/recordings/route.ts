import { NextRequest, NextResponse } from 'next/server';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const s3Client = new S3Client({
      region: process.env.S3_REGION || 'us-east-1',
      endpoint: process.env.S3_ENDPOINT || 'http://172.17.0.1:9000',
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY || '',
        secretAccessKey: process.env.S3_SECRET || '',
      },
      forcePathStyle: true,
    });

    const response = await s3Client.send(new ListObjectsV2Command({
      Bucket: process.env.S3_BUCKET || 'livekit-recordings',
      Prefix: 'webinaire/',
    }));

    const files = (response.Contents || [])
      .filter(obj => obj.Key?.endsWith('.mp4'))
      .map(obj => {
        const key = obj.Key || '';
        const filename = key.replace('webinaire/', '');
        const size = obj.Size || 0;
        const lastModified = obj.LastModified || new Date();
        const match = filename.match(/^(.+?)-(\d{4}-\d{2}-\d{2}T\d{6})\.mp4$/);
        const roomName = match ? match[1] : filename;
        const dateStr = match ? match[2] : '';
        const recordingDate = dateStr
          ? `${dateStr.substring(0,4)}-${dateStr.substring(5,7)}-${dateStr.substring(8,10)} à ${dateStr.substring(11,13)}:${dateStr.substring(13,15)}:${dateStr.substring(15,17)}`
          : lastModified.toLocaleString('fr-FR');
        const sizeFormatted = size < 1024*1024
          ? `${(size/1024).toFixed(1)} Ko`
          : `${(size/(1024*1024)).toFixed(1)} Mo`;
        return {
          key,
          filename,
          roomName,
          recordingDate,
          size,
          sizeFormatted,
          lastModified: lastModified.toISOString(),
        };
      })
      .sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());

    return NextResponse.json({ files }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error' },
      { status: 500 }
    );
  }
}
