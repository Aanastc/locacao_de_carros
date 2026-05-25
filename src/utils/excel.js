import * as XLSX from 'xlsx-js-style'

export const applyStylesToSheet = (ws) => {
  // Configuração de largura das colunas
  const colWidths = [{ wch: 2 }, { wch: 25 }, ...Array(12).fill({ wch: 15 }), { wch: 18 }]
  ws['!cols'] = colWidths

  const range = XLSX.utils.decode_range(ws['!ref'])
  
  for (let R = range.s.r; R <= range.e.r; ++R) {
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellAddress = { c: C, r: R }
      const cellRef = XLSX.utils.encode_cell(cellAddress)
      
      // Se a célula não existe, cria uma vazia para poder estilizar a borda
      if (!ws[cellRef]) {
        ws[cellRef] = { v: '', t: 's' }
      }
      const cell = ws[cellRef]
      
      let style = {
        font: { name: 'Arial', sz: 10, color: { rgb: "1F2937" } },
        alignment: { vertical: 'center', horizontal: 'left' },
        border: {
          top: { style: 'thin', color: { rgb: "E5E7EB" } },
          bottom: { style: 'thin', color: { rgb: "E5E7EB" } },
          left: { style: 'thin', color: { rgb: "E5E7EB" } },
          right: { style: 'thin', color: { rgb: "E5E7EB" } }
        }
      }

      const val = cell.v
      const strVal = String(val).toLowerCase()

      // Linha 0 (Título)
      if (R === 0) {
        style.font = { name: 'Arial', sz: 14, bold: true, color: { rgb: "FFFFFF" } }
        style.fill = { fgColor: { rgb: "1F2937" } } // Cinza escuro
        style.alignment = { vertical: 'center', horizontal: 'center' }
        if (C === 0) {
          ws['!merges'] = ws['!merges'] || []
          ws['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: range.e.c } })
        }
      }
      // Cabeçalhos das tabelas (CATEGORIA, Mês, TOTAL, TOTAIS)
      else if (R === 2 || strVal === 'receitas' || strVal === 'automóvel' || strVal === 'totais') {
        style.font = { name: 'Arial', sz: 10, bold: true, color: { rgb: "FFFFFF" } }
        style.fill = { fgColor: { rgb: "3B82F6" } } // Azul
        style.alignment = { vertical: 'center', horizontal: 'center' }
        
        if (strVal === 'receitas' || strVal === 'automóvel') {
            style.alignment = { vertical: 'center', horizontal: 'left' }
        }
      }
      // Coluna das Categorias (Nome da Despesa/Receita)
      else if (C === 1 && R > 2) {
        style.font = { name: 'Arial', sz: 10, bold: true, color: { rgb: "374151" } }
        if (strVal === 'rendimentos') style.fill = { fgColor: { rgb: "D1FAE5" } }
        else if (strVal === 'gastos') style.fill = { fgColor: { rgb: "FEE2E2" } }
        else if (strVal === 'saldo do mês' || strVal === 'saldo acumulado') style.fill = { fgColor: { rgb: "DBEAFE" } }
        else style.fill = { fgColor: { rgb: "F3F4F6" } }
      }
      // Valores (Meses e Total)
      else if (C > 1 && R > 2) {
        style.alignment = { vertical: 'center', horizontal: 'right' }
        
        if (typeof val === 'number') {
          cell.z = '"R$" #,##0.00' // Moeda Brasil
        }
        
        // Colore fundo das linhas de totalizadores baseando no nome da linha
        const rowCategoryCell = ws[XLSX.utils.encode_cell({ c: 1, r: R })]
        const rowCategory = rowCategoryCell?.v?.toString().toLowerCase() || ''
        
        if (rowCategory === 'rendimentos') {
          style.fill = { fgColor: { rgb: "D1FAE5" } }
          style.font.color = { rgb: "059669" }
          style.font.bold = true
        } else if (rowCategory === 'gastos') {
          style.fill = { fgColor: { rgb: "FEE2E2" } }
          style.font.color = { rgb: "DC2626" }
          style.font.bold = true
        } else if (rowCategory === 'saldo do mês' || rowCategory === 'saldo acumulado') {
          style.fill = { fgColor: { rgb: "DBEAFE" } }
          style.font.color = { rgb: "2563EB" }
          style.font.bold = true
          if (typeof val === 'number' && val < 0) {
            style.font.color = { rgb: "DC2626" }
          }
        }
      }

      cell.s = style
    }
  }
}
