import * as XLSX from 'xlsx';

function test() {
  const ws = XLSX.utils.aoa_to_sheet([
    ['Name', 'Age'],
    ['Alice', 30],
    ['Bob', 25]
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  
  // write to buffer
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  
  // now read it back
  const readWb = XLSX.read(buffer, { type: 'buffer' });
  const readWs = readWb.Sheets[readWb.SheetNames[0]];
  const csv = XLSX.utils.sheet_to_csv(readWs);
  console.log('CSV:');
  console.log(csv);
}
test();