import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// An option for a single-select filter. `value` is either a domain value (`T`)
// or the UI-only `'all'` sentinel meaning "no filter".
export type FilterOption<T extends string> = { value: T | 'all'; label: string }

// A single-select dropdown filter. It only reports the selected value via
// `onChange` — filtering itself is left to the caller (e.g. server-side).
export function FilterSelect<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: FilterOption<T>[]
  value: T | 'all'
  onChange: (value: T | 'all') => void
}) {
  return (
    <Select
      // Cast to `string` so base-ui's generic value inference settles (the
      // `T | 'all'` union otherwise makes it infer the bare `'all'` literal).
      value={value as string}
      onValueChange={(next) => onChange(((next as string) ?? 'all') as T | 'all')}
    >
      <SelectTrigger size="sm" className="min-w-40" aria-label={label}>
        <SelectValue>
          {(selected: string | null) =>
            options.find((o) => o.value === (selected ?? 'all'))?.label
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
