import HTMLtoDOCX from 'html-to-docx';
import fs from 'fs/promises';

async function test() {
  const htmlString = '<h1>Hello World</h1><p>This is a test</p>';
  const fileBuffer = await HTMLtoDOCX(htmlString, null, {
    table: { row: { addCantSplit: true } },
    footer: true,
    pageNumber: true,
  });

  await fs.writeFile('test2.docx', fileBuffer);
  console.log('Success HTMLtoDOCX');
}
test().catch(console.error);