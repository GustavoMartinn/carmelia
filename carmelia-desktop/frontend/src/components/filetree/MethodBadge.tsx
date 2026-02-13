const METHOD_COLORS: Record<string, string> = {
  GET: 'text-green-400',
  POST: 'text-yellow-400',
  PUT: 'text-blue-400',
  PATCH: 'text-purple-400',
  DELETE: 'text-red-400',
  HEAD: 'text-gray-400',
  OPTIONS: 'text-gray-400',
}

export function MethodBadge({ method }: { method: string }) {
  const color = METHOD_COLORS[method] || 'text-gray-400'

  return (
    <span className={`${color} text-[10px] font-bold uppercase tracking-tight w-9 text-right flex-shrink-0`}>
      {method.length > 3 ? method.slice(0, 3) : method}
    </span>
  )
}
