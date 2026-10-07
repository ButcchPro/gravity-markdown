import { md2docx } from '@m2d/md2docx';
import fs from 'fs/promises';

async function test() {
  const blob = await md2docx('# Hello World\n\nThis is a test');
  const buffer = Buffer.from(await blob.arrayBuffer());
  await fs.writeFile('test.docx', buffer);
  console.log('Success');
}
test().catch(console.error);