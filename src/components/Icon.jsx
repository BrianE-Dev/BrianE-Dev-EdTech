import {
  ArrowRight,
  BookOpen,
  Check,
  Clock3,
  Code2,
  Grid2X2,
  Headphones,
  LockKeyhole,
  Menu,
  Moon,
  Pause,
  Play,
  Sun,
  X,
} from 'lucide-react'

const icons = {
  grid: Grid2X2,
  book: BookOpen,
  play: Play,
  arrow: ArrowRight,
  check: Check,
  menu: Menu,
  close: X,
  code: Code2,
  headphones: Headphones,
  lock: LockKeyhole,
  clock: Clock3,
  moon: Moon,
  pause: Pause,
  sun: Sun,
}

export default function Icon({ name, size = 18, ...props }) {
  const LucideIcon = icons[name]
  if (!LucideIcon) return null
  return <LucideIcon aria-hidden="true" size={size} strokeWidth={1.7} {...props} />
}
