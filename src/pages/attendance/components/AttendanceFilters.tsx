import { Input } from "@/components/ui/Input";
import { ATTENDANCE_STATUS_LABELS } from "@/constants/attendance";
import type { AttendanceStatus } from "@/types/attendance";

interface ProjectOption { id: string; name: string }
interface Props { month: string; search: string; status: AttendanceStatus | "all"; projectId: string; projects: ProjectOption[]; onMonth: (value: string) => void; onSearch: (value: string) => void; onStatus: (value: AttendanceStatus | "all") => void; onProject: (value: string) => void }
const selectClass = "h-11 rounded-md border border-[#D0D0D0] bg-white px-3 text-sm text-text-primary shadow-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15";

export function AttendanceFilters(props: Props) {
  return <div className="grid gap-3 md:grid-cols-4">
    <Input aria-label="Attendance month" type="month" value={props.month} onChange={(event) => props.onMonth(event.target.value)} />
    <Input aria-label="Search employee" placeholder="Search employee" value={props.search} onChange={(event) => props.onSearch(event.target.value)} />
    <select aria-label="Filter by attendance status" className={selectClass} value={props.status} onChange={(event) => props.onStatus(event.target.value as AttendanceStatus | "all")}><option value="all">All statuses</option>{Object.entries(ATTENDANCE_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
    <select aria-label="Filter by project" className={selectClass} value={props.projectId} onChange={(event) => props.onProject(event.target.value)}><option value="">All projects</option>{props.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select>
  </div>;
}
