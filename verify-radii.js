/**
 * 验证 radii-extracted.json 与 HTML 表中每个元素的行数是否一致
 * Run: node verify-radii.js
 */
const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname);
const inputPath = path.join('c:', 'Users', 'rlzhao', 'Desktop', 'Radii for All Species.html');

if (!fs.existsSync(inputPath)) {
    console.log('HTML file not found:', inputPath);
    process.exit(1);
}

const html = fs.readFileSync(inputPath, 'utf8');

function stripTags(s) {
    return (s || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
}

const tableStart = html.indexOf('Crystal Radius');
const tableEnd = html.indexOf('</table>', tableStart);
const tableHtml = html.slice(tableStart, tableEnd);

const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;

let currentIon = '';
let currentCharge = '';
const expectedCount = {};  // ion -> 期望的数据行数
let totalRows = 0;

let m;
while ((m = rowRegex.exec(tableHtml)) !== null) {
    const rowHtml = m[1];
    const cells = [];
    let cellM;
    cellRegex.lastIndex = 0;
    while ((cellM = cellRegex.exec(rowHtml)) !== null) {
        cells.push(stripTags(cellM[1]));
    }
    if (cells.length < 5) continue;
    if (cells[0] === 'Ion' || (cells.length >= 7 && cells[4] === 'Crystal Radius')) continue;

    let ion, charge, coord, spin, crystal, ionic;
    if (cells.length >= 7) {
        ion = cells[0];
        charge = cells[1];
        coord = cells[2];
        spin = cells[3];
        crystal = cells[4];
        ionic = cells[5];
    } else if (cells.length === 6) {
        ion = currentIon;
        charge = cells[0];
        coord = cells[1];
        spin = cells[2];
        crystal = cells[3];
        ionic = cells[4];
    } else {
        // 5 cells: Ion 和 Charge 都有 rowspan
        ion = currentIon;
        charge = currentCharge;
        coord = cells[0];
        spin = cells[1];
        crystal = cells[2];
        ionic = cells[3];
    }
    if (ion && ion.length <= 2 && /^[A-Z][a-z]?$/.test(ion)) currentIon = ion;
    if (charge && /^-?\d+$/.test(charge)) currentCharge = charge;

    const cNum = parseFloat(crystal);
    const iNum = parseFloat(ionic);
    if (isNaN(cNum) && isNaN(iNum)) continue;

    expectedCount[currentIon] = (expectedCount[currentIon] || 0) + 1;
    totalRows++;
}

const jsonPath = path.join(projectRoot, 'radii-extracted.json');
const radii = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

const missing = [];
const extra = [];
const mismatch = [];

for (const sym of Object.keys(expectedCount)) {
    const exp = expectedCount[sym];
    const actual = radii[sym] ? radii[sym].length : 0;
    if (actual === 0) {
        missing.push({ sym, expected: exp });
    } else if (actual !== exp) {
        mismatch.push({ sym, expected: exp, actual });
    }
}
for (const sym of Object.keys(radii)) {
    if (!expectedCount[sym] && radii[sym].length > 0) {
        extra.push({ sym, actual: radii[sym].length });
    }
}

const totalExpected = totalRows;
const totalActual = Object.values(radii).reduce((s, arr) => s + arr.length, 0);

console.log('=== 验证结果 ===');
console.log('HTML 表数据行总数:', totalExpected);
console.log('JSON 总条数:', totalActual);
console.log('');

if (mismatch.length > 0) {
    console.log('行数不一致的元素 (expected vs actual):');
    mismatch.forEach(({ sym, expected, actual }) => console.log('  ', sym, '  期望:', expected, '  实际:', actual));
    console.log('');
}
if (missing.length > 0) {
    console.log('HTML 有但 JSON 无的元素:', missing.map(x => x.sym).join(', '));
    console.log('');
}
if (extra.length > 0) {
    console.log('JSON 有但 HTML 未出现的元素:', extra.map(x => x.sym).join(', '));
    console.log('');
}

if (mismatch.length === 0 && missing.length === 0 && extra.length === 0 && totalExpected === totalActual) {
    console.log('所有元素行数一致，无遗漏。');
} else {
    process.exit(1);
}
