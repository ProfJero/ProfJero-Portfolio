// Status labels and progress timelines for bookings and quote/orders.
import { esc } from "./utils.js";

export const STATUS = {
  pending: ["Received", "fa-regular fa-clock", "We've received your booking and will confirm shortly."],
  confirmed: ["Confirmed", "fa-solid fa-calendar-check", "Your booking is confirmed."],
  completed: ["Completed", "fa-solid fa-circle-check", "This booking is complete. Thank you!"],
  cancelled: ["Cancelled", "fa-solid fa-ban", "This booking was cancelled."],
  requested: ["Quote requested", "fa-regular fa-clock", "We're preparing your quote."],
  quoted: ["Quote ready", "fa-solid fa-file-invoice", "Your quote is ready — sign in to the client portal to approve it."],
  approved: ["Approved", "fa-solid fa-thumbs-up", "Thanks! Production will be scheduled."],
  "in-production": ["In production", "fa-solid fa-gears", "Your items are being branded."],
  ready: ["Ready", "fa-solid fa-box", "Your order is ready for pickup or delivery."],
  delivered: ["Delivered", "fa-solid fa-truck-fast", "Delivered. Thank you for choosing ProfJero Hub!"],
  declined: ["Quote declined", "fa-solid fa-xmark", "You declined this quote."]
};
export const FLOW = { bookings: ["pending", "confirmed", "completed"], orders: ["requested", "quoted", "approved", "in-production", "ready", "delivered"] };

export function timeline(col, status) {
  const flow = FLOW[col];
  const idx = flow.indexOf(status);
  if (idx < 0) return `<div class="status-banner ${esc(status)}"><i class="${STATUS[status]?.[1] || "fa-solid fa-circle-info"}"></i> ${esc(STATUS[status]?.[2] || status)}</div>`;
  return `<ol class="timeline-h">${flow.map((s, i) => `<li class="${i < idx ? "done" : i === idx ? "current" : ""}"><span><i class="${STATUS[s][1]}"></i></span>${STATUS[s][0]}</li>`).join("")}</ol>`;
}

