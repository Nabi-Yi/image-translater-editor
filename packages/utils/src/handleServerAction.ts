export function throwServerAction(message?: string, data?: any) {
  return { status: "error", message: message || "error", data: data || null };
}

export function successServerAction(message?: string, data?: any) {
  return { status: "success", message: message || "success", data: data || null };
}
