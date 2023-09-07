import child_process from 'child_process';
import { resolve } from 'path';
import { writeFile } from 'fs/promises';
import { ApexOptions } from 'apexcharts';
import { writeFile as writeXlsx, utils } from 'xlsx';

function openHtmlFile(path) {
  let command = '';
  switch (process.platform) {
    case 'darwin':
      command = 'open chrome';
      break;
    case 'win32':
      command = 'start chrome';
      break;
    default:
      command = 'xdg-open';
      break;
  }
  return child_process.execSync(`${command} "${resolve(path)}"`);
}

export async function outputChart(filename: string, options: ApexOptions = {}) {
  const output = `
<!DOCTYPE html>
<html>
<head>
</head>
<body>
<script src="https://cdn.jsdelivr.net/npm/apexcharts"></script>
  <div id="chart" style="width: 98vw; height: 98vh; box-sizing: border-box; border: #0a58ca solid 1px"></div>
  <script>
    var options = {
          series: [{
            name: "Desktops",
            data: [10, 41, 35, 51, 49, 62, 69, 91, 148]
        }],
          chart: {
          height: 500,
          type: 'line',
          zoom: {
            enabled: false
          }
        },
        dataLabels: {
          enabled: false
        },
        stroke: {
          curve: 'straight'
        },
        title: {
          text: 'Product Trends by Month',
          align: 'left'
        },
        grid: {
          row: {
            colors: ['#f3f3f3', 'transparent'], // takes an array which will be repeated on columns
            opacity: 0.5
          },
        },
        ...(${JSON.stringify(options)})
        };

        var chart = new ApexCharts(document.querySelector("#chart"), options);
        chart.render();

        console.log(options);
  </script>
</body>
</html>
  `;

  await writeFile(`./${filename}.html`, output, 'utf8');

  openHtmlFile(`./${filename}.html`);
}

export async function outputTable(
  filename: string,
  data: Record<string, unknown>[],
  css = `
    table, th, td {
      border: #0d6efd solid 1px;
      padding: 3px;
      font-size: 2.3rem;
    }
  `
) {
  const tableHeaders = `
    <tr>
      ${Object.keys(data[0])
        .map((key) => `<th>${key}</th>`)
        .join('')}
    </tr>`;

  const tableRows = data
    .map(
      (row) => `
      <tr>
        ${Object.values(row)
          .map((col) => `<td>${col}</td>`)
          .join('')}
      </tr>`
    )
    .join('');

  const tableOutput = `
    <table>
      ${tableHeaders}${tableRows}
    </table>`;

  const output = `
<!DOCTYPE html>
<html>
<head>
<style>
${css}
</style>
</head>
<body>
${tableOutput}
</body>
</html>
  `;

  await writeFile(`./${filename}.html`, output, 'utf8');

  openHtmlFile(`./${filename}.html`);
}

export function toCsv(data: Record<string, unknown>[]) {
  const headers = Object.keys(data[0]).join(',') + '\n';

  return (
    headers +
    data
      .map((row) =>
        Object.values(row)
          .map((value) => {
            if (typeof value === 'string') {
              return `"${value}"`.replaceAll(/\n|\s{2,}/g, ' ');
            }

            if (value instanceof Date) {
              return value.toISOString();
            }

            if (value === null || value === undefined) {
              return '';
            }

            return value;
          })
          .join(',')
      )
      .join('\n')
  );
}

export function outputCsv(filename: string, data: Record<string, unknown>[]) {
  return writeFile(
    filename.endsWith('.csv') ? filename : `${filename}.csv`,
    toCsv(data),
    'utf8'
  );
}

export function outputJson(filename: string, data: Record<string, unknown>[]) {
  return writeFile(
    filename.endsWith('.json') ? filename : `${filename}.json`,
    JSON.stringify(data, null, 2),
    'utf8'
  );
}

export type SheetConfig = {
  sheetName: string;
  data: Record<string, unknown>[];
}

export async function outputExcel(
  filename: string,
  sheets: SheetConfig[]
) {
  const workbook = utils.book_new();

  for (const sheet of sheets) {
    const { sheetName, data } = sheet;
    const worksheet = utils.json_to_sheet(data);
    utils.book_append_sheet(workbook, worksheet, sheetName);
  }

  return await writeXlsx(
    workbook,
    filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`,
    { compression: true }
  );
}
