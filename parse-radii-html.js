/**
 * One-off script: parse "Radii for All Species.html" and output radii JSON.
 * Run: node parse-radii-html.js
 * Input: c:\Users\rlzhao\Desktop\Radii for All Species.html
 * Output: radii by element symbol; crystal/ionic in Angstroms, we store in pm (×100).
 */
const fs = require('fs');
const path = require('path');

const inputPath = path.join('c:', 'Users', 'rlzhao', 'Desktop', 'Radii for All Species.html');
const html = fs.readFileSync(inputPath, 'utf8');

function stripTags(s) {
    return (s || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
}

// Find all <tr>...</tr> in the data table (after header "Ionic Radius")
const tableStart = html.indexOf('Crystal Radius');
const tableEnd = html.indexOf('</table>', tableStart);
const tableHtml = html.slice(tableStart, tableEnd);

const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;

let currentIon = '';
let currentCharge = '';
const radiiBySymbol = {};

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
    // Skip only real header row (Ion / Crystal Radius)
    if (cells[0] === 'Ion' || (cells.length >= 7 && cells[4] === 'Crystal Radius')) continue;
    // Assign columns: with rowspan, we have 7, 6, or 5 cells (5 when both Ion and Charge have rowspan)
    let ion, charge, coord, spin, crystal, ionic, key;
    if (cells.length >= 7) {
        ion = cells[0];
        charge = cells[1];
        coord = cells[2];
        spin = cells[3];
        crystal = cells[4];
        ionic = cells[5];
        key = cells[6];
    } else if (cells.length === 6) {
        ion = currentIon;
        charge = cells[0];
        coord = cells[1];
        spin = cells[2];
        crystal = cells[3];
        ionic = cells[4];
        key = cells[5];
    } else {
        ion = currentIon;
        charge = currentCharge;
        coord = cells[0];
        spin = cells[1];
        crystal = cells[2];
        ionic = cells[3];
        key = cells[4];
    }
    if (ion && ion.length <= 2 && /^[A-Z][a-z]?$/.test(ion)) currentIon = ion;
    if (charge && /^-?\d+$/.test(charge)) currentCharge = charge;
    const cNum = parseFloat(crystal);
    const iNum = parseFloat(ionic);
    if (isNaN(cNum) && isNaN(iNum)) continue;
    if (!radiiBySymbol[currentIon]) radiiBySymbol[currentIon] = [];
    radiiBySymbol[currentIon].push({
        charge: currentCharge,
        coord: coord,
        spin: (spin && spin.trim()) || '',
        crystal: isNaN(cNum) ? null : Math.round(cNum * 100),
        ionic: isNaN(iNum) ? null : Math.round(iNum * 100)
    });
}

// Output as JS module format for copying into data.js
const out = JSON.stringify(radiiBySymbol, null, 2);
fs.writeFileSync(path.join(__dirname, 'radii-extracted.json'), out, 'utf8');
console.log('Parsed', Object.keys(radiiBySymbol).length, 'elements. Output: radii-extracted.json');
