/**
 * Or, 25/10: a slot template Meta has not approved yet → the channel's open template (logged), never a failure.
 */
const alert = jest.fn();
jest.mock("@/lib/alldog/failure-alerts", () => ({ alertAllDogFailure: (...a: unknown[]) => alert(...a) }));

import { sendTemplateSteps } from "@/lib/alldog-bot/wa";
import { missedCallSteps } from "@/lib/alldog/missed-call-rules";

const OLD = process.env;
const fetchMock = jest.fn();
beforeEach(() => {
  process.env = { ...OLD, ALLDOG_WA_TOKEN: "t", ALLDOG_WA_PHONE_NUMBER_ID: "p" };
  fetchMock.mockReset();
  alert.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
  jest.spyOn(console, "warn").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  process.env = OLD;
});
const ok = (id: string) => ({ ok: true, status: 200, text: async () => JSON.stringify({ messages: [{ id }] }) });
const notApproved = { ok: false, status: 404, text: async () => JSON.stringify({ error: { code: 132001, message: "Template name does not exist in the translation" } }) };

it("pending template → falls back to the open one, no alert", async () => {
  fetchMock.mockResolvedValueOnce(notApproved).mockResolvedValueOnce(ok("wamid.open"));
  const r = await sendTemplateSteps("972541234567", missedCallSteps({ kind: "weekend" }), "he");
  expect(r?.wamid).toBe("wamid.open");
  expect(r?.step.name).toBe("missed_call_followup");
  expect(r?.fellBackFrom).toEqual(["missed_call_weekend"]);
  expect(alert).not.toHaveBeenCalled();
  const first = JSON.parse(fetchMock.mock.calls[0][1].body);
  expect(first.template.name).toBe("missed_call_weekend");
});

it("approved slot template → sent with its body params", async () => {
  fetchMock.mockResolvedValueOnce(ok("wamid.ah"));
  const r = await sendTemplateSteps("972541234567", missedCallSteps({ kind: "after_hours", phrase: "מחר בבוקר" }), "he");
  expect(r?.step.name).toBe("missed_call_after_hours");
  const body = JSON.parse(fetchMock.mock.calls[0][1].body);
  expect(body.template.components).toEqual([{ type: "body", parameters: [{ type: "text", text: "מחר בבוקר" }] }]);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("every step failed → null + one alert (item 31)", async () => {
  fetchMock.mockResolvedValue(notApproved);
  const r = await sendTemplateSteps("972541234567", missedCallSteps({ kind: "weekend" }), "he");
  expect(r).toBeNull();
  expect(alert).toHaveBeenCalledTimes(1);
  expect(alert.mock.calls[0][0]).toMatchObject({ kind: "wa_send" });
});
