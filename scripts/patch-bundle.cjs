const fs = require('fs')
const path = require('path')

const file = path.resolve(__dirname, '../dist/assets/index-DrC-6iQT.js')
let content = fs.readFileSync(file, 'utf8')

const replacements = [
  [
    'grid grid-cols-1 lg:grid-cols-12 gap-2.5 flex-1 min-h-0 w-full overflow-hidden',
    'grid grid-cols-1 md:grid-cols-12 gap-2.5 flex-1 min-h-0 w-full overflow-y-auto md:overflow-hidden'
  ],
  [
    'lg:col-span-8 flex flex-col bg-white border border-slate-300 rounded-sm shadow-xs overflow-hidden h-full',
    'md:col-span-7 xl:col-span-8 flex flex-col bg-white border border-slate-300 rounded-sm shadow-xs overflow-hidden h-full min-h-[340px]'
  ],
  [
    'lg:col-span-4 flex flex-col bg-white border border-slate-300 rounded-sm shadow-xs p-3.5 justify-between h-full space-y-3 overflow-y-auto custom-scroll',
    'md:col-span-5 xl:col-span-4 flex flex-col bg-white border border-slate-300 rounded-sm shadow-xs p-3.5 justify-between h-full space-y-3 overflow-y-auto custom-scroll min-h-[340px]'
  ],
  [
    'overflow-hidden p-2 sm:p-2.5',
    'overflow-y-auto md:overflow-hidden p-2 sm:p-2.5'
  ],
  [
    '()=>{document.documentElement.style.zoom="100%"},[])',
    '()=>{},[])'
  ]
]

replacements.forEach(([target, replacement]) => {
  if (content.includes(target)) {
    content = content.replace(target, replacement)
    console.log('Replaced:', target.slice(0, 35) + '...')
  } else {
    console.warn('NOT FOUND:', target.slice(0, 35) + '...')
  }
})

fs.writeFileSync(file, content, 'utf8')
console.log('Successfully updated dist bundle!')
