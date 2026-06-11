import XLSX from 'xlsx';
import fs from 'fs';

const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet([['A','B'],['x','y']]);
ws['A2'] = { t: 's', v: 'x', s: { fill: { fgColor: { rgb: 'FEE2E2' }, patternType: 'solid' }, font: { color: { rgb: 'B91C1C' }, bold: true } } };
XLSX.utils.book_append_sheet(wb, ws, 'S');
const out = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer', cellStyles: true });
fs.writeFileSync('tmp-style-test.xlsx', out);
console.log('wrote tmp-style-test.xlsx', out.length);
