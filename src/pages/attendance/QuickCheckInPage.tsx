import { Camera, LogIn, LogOut, MapPin } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { AttendanceStatusBadge } from "@/components/attendance/AttendanceStatusBadge";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { FormField } from "@/components/forms/FormField";
import { attendanceService } from "@/services/attendanceService";
import { useAuth } from "@/hooks/useAuth";
import { useSelectableProjects } from "@/hooks/useSelectableProjects";
import { LocationCaptureError, locationService } from "@/services/locationService";
import { offlineQueueService } from "@/services/offlineQueueService";
import { uploadAttendanceSelfie } from "@/services/attendanceEvidenceService";
import type { AttendanceRecord, GeoLocationPoint } from "@/types/attendance";
import { evaluateGeofence } from "@/utils/geo";

const selectClass =
  "h-11 w-full rounded-md border border-[#D0D0D0] bg-white px-3 text-sm text-text-primary shadow-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15";

export function QuickCheckInPage() {
  const { user } = useAuth();
  const { projects } = useSelectableProjects(user);
  const [record, setRecord] = useState<AttendanceRecord | undefined>();
  const [location, setLocation] = useState<GeoLocationPoint | undefined>();
  const [projectId, setProjectId] = useState("");
  const [loading, setLoading] = useState(false);
  const [selfie, setSelfie] = useState<File>();
  const [locationFailure, setLocationFailure] = useState<LocationCaptureError>();

  const loadToday = useCallback(async () => {
    if (!user) {
      return;
    }
    setRecord(await attendanceService.getTodayAttendance(user));
  }, [user]);

  useEffect(() => {
    void loadToday();
  }, [loadToday]);

  useEffect(() => {
    setProjectId((current) =>
      projects.some((project) => project.id === current)
        ? current
        : projects[0]?.id ?? "",
    );
  }, [projects]);

  if (!user) {
    return null;
  }

  async function captureLocation() {
    try {
      const captured = await locationService.capture();
      setLocationFailure(undefined);
      setLocation(captured);
      return captured;
    } catch (error) {
      if (error instanceof LocationCaptureError) setLocationFailure(error);
      throw error;
    }
  }

  const selectedProject = projects.find((project) => project.id === projectId);
  const geofence =
    location &&
    selectedProject?.latitude != null &&
    selectedProject.longitude != null
      ? evaluateGeofence(location, {
          latitude: selectedProject.latitude,
          longitude: selectedProject.longitude,
          geofenceRadius: selectedProject.geofenceRadius,
        })
      : undefined;

  async function checkIn() {
    if (!user) {
      return;
    }
    const currentUser = user;
    setLoading(true);
    try {
      const captured = location ?? (await captureLocation());
      if (!selfie) throw new Error("Capture a live selfie before checking in.");
      const mutationId=crypto.randomUUID(), capturedAt=new Date().toISOString();
      if (!selectedProject) {
        throw new Error("Select an assigned project.");
      }
      if (!geofence && selectedProject.latitude != null && selectedProject.longitude != null) {
        const result = evaluateGeofence(captured, {
          latitude: selectedProject.latitude,
          longitude: selectedProject.longitude,
          geofenceRadius: selectedProject.geofenceRadius,
        });
        if (!result.atSite) {
          throw new Error(`You are ${Math.round(result.distanceMeters)} m from the selected site.`);
        }
      } else if (geofence && !geofence.atSite) {
        throw new Error(`You are ${Math.round(geofence.distanceMeters)} m from the selected site.`);
      }
      if (!navigator.onLine) {
        await offlineQueueService.enqueue({
          type: "attendance-check-in",
          payload: { userId: currentUser.id, projectId, location: captured, selfie, mutationId, capturedAt },
        });
        toast.success("Check-in queued and will be available for sync when online.");
        return;
      }
      const selfiePath=await uploadAttendanceSelfie(currentUser.organizationId ?? "",currentUser.id,selfie,mutationId);
      await attendanceService.checkIn(currentUser, captured, projectId,{selfiePath,capturedAt,clientMutationId:mutationId});
      toast.success("Checked in successfully.");
      await loadToday();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to check in.");
    } finally {
      setLoading(false);
    }
  }

  async function checkOut() {
    if (!user) {
      return;
    }
    const currentUser = user;
    setLoading(true);
    try {
      const captured = location ?? (await captureLocation());
      if (!selfie) throw new Error("Capture a live selfie before checking out.");
      const mutationId=crypto.randomUUID(), capturedAt=new Date().toISOString();
      if (!navigator.onLine) {
        await offlineQueueService.enqueue({
          type: "attendance-check-out",
          payload: { userId: currentUser.id, location: captured, selfie, mutationId, capturedAt },
        });
        toast.success("Check-out queued and will sync when online.");
        return;
      }
      const selfiePath=await uploadAttendanceSelfie(currentUser.organizationId ?? "",currentUser.id,selfie,mutationId);
      await attendanceService.checkOut(currentUser, captured,{selfiePath,capturedAt,clientMutationId:mutationId});
      toast.success("Checked out successfully.");
      await loadToday();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to check out.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Quick Check-In"
        description="Capture GPS location and record today's attendance punch."
        breadcrumbs={[
          { label: "Home", to: "/home" },
          { label: "Attendance", to: "/attendance" },
          { label: "Quick Check-In" },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle>Location Capture</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField label="Assigned Project / Site">
              <select
                className={selectClass}
                value={projectId}
                onChange={(event) => {
                  setProjectId(event.target.value);
                  setLocation(undefined);
                }}
              >
                <option value="">Select assigned project</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </FormField>
            <div className="rounded-lg border border-surface-border bg-slate-50 p-4">
              <p className="flex items-center gap-2 text-sm font-bold text-text-primary">
                <MapPin className="h-4 w-4 text-brand-blue" />
                GPS Status
              </p>
              <p className="mt-2 text-sm text-text-secondary">
                {location
                  ? `${location.source === "android" ? "Android GPS" : "Browser location"}: ${geofence?.atSite ? "At Site" : geofence ? "Away From Site" : "captured"} with ${location.accuracy}m accuracy${geofence ? `, ${Math.round(geofence.distanceMeters)} m from site center.` : "."}`
                  : "Capture location before punching attendance."}
              </p>
              {locationFailure ? <p className="mt-2 text-sm font-semibold text-red-700">{locationFailure.message}</p> : null}
            </div>
            <Button
              type="button"
              variant="secondary"
              leftIcon={<MapPin className="h-4 w-4" />}
              onClick={() => void captureLocation()}
            >
              Capture GPS
            </Button>
            {locationFailure?.code === "permission_denied_permanently" ? (
              <Button type="button" variant="secondary" onClick={() => void locationService.openSettings("app").catch((error) => toast.error(error.message))}>Open Device Settings</Button>
            ) : null}
            {locationFailure?.code === "gps_off" ? (
              <Button type="button" variant="secondary" onClick={() => void locationService.openSettings("location").catch((error) => toast.error(error.message))}>Open Location Settings</Button>
            ) : null}
            <label className="flex cursor-pointer items-center gap-2 rounded-md border border-surface-border p-3 text-sm font-semibold">
              <Camera className="h-4 w-4 text-brand-blue" />
              {selfie ? "Selfie captured" : "Capture live selfie"}
              <input className="sr-only" type="file" accept="image/*" capture="user" onChange={e=>setSelfie(e.target.files?.[0])}/>
            </label>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Today Attendance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {record ? (
              <div className="rounded-lg border border-surface-border p-4">
                <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
                  <div>
                    <p className="font-bold text-text-primary">
                      {record.projectName}
                    </p>
                    <p className="mt-1 text-sm text-text-secondary">
                      Check-in {record.checkInTime ?? "-"} · Check-out{" "}
                      {record.checkOutTime ?? "-"} · {record.workedHours.toFixed(1)}h
                    </p>
                  </div>
                  <AttendanceStatusBadge status={record.status} />
                </div>
              </div>
            ) : (
              <p className="text-sm text-text-secondary">
                No attendance recorded today.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                leftIcon={<LogIn className="h-4 w-4" />}
                isLoading={loading}
                disabled={Boolean(record?.checkInTime)}
                onClick={() => void checkIn()}
              >
                Check In
              </Button>
              <Button
                type="button"
                variant="secondary"
                leftIcon={<LogOut className="h-4 w-4" />}
                isLoading={loading}
                disabled={!record?.checkInTime || Boolean(record.checkOutTime)}
                onClick={() => void checkOut()}
              >
                Check Out
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
