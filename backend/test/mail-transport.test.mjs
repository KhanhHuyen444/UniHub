import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createGmailSmtpTransport,
  createResendTransport,
  MAIL_TIMEOUT_MS,
} from '../dist/modules/events/mail-transport.js';
import {
  IDEMPOTENCY_WINDOW_MS,
  MAX_RETRY_DELAY_MS,
  retryDecision,
} from '../dist/modules/events/reminder-email-policy.js';

const payload =
  '{"from":"sender@example.test","to":["student@example.test"],"subject":"Reminder","html":"<p>Frozen</p>","text":"Frozen"}';
const options = () => ({
  idempotencyKey: 'unihub/test/event-reminder/42',
  signal: new AbortController().signal,
});
const id = '49a3999c-0ce1-4ea6-ab68-afcd6dc2e794';

test('Resend adapter makes one exact HTTP request, with no redirects or SDK retries', async () => {
  const calls = [];
  const transport = createResendTransport('test-only-key', {
    fetch: async (...args) => {
      calls.push(args);
      return new Response(JSON.stringify({ id, sensitive: 'discarded' }), {
        status: 200,
      });
    },
  });
  assert.deepEqual(await transport.send(payload, options()), {
    providerEmailId: id,
  });
  assert.equal(calls.length, 1);
  const [url, init] = calls[0];
  assert.equal(url, 'https://api.resend.com/emails');
  assert.equal(init.method, 'POST');
  assert.equal(init.redirect, 'error');
  assert.equal(init.body, payload);
  assert.equal(init.headers.Authorization, 'Bearer test-only-key');
  assert.equal(init.headers['Content-Type'], 'application/json');
  assert.equal(init.headers['Idempotency-Key'], options().idempotencyKey);
  assert.equal(MAIL_TIMEOUT_MS, 10_000);
});

for (const [status, body, code, retryable] of [
  [408, {}, 'REQUEST_TIMEOUT', true],
  [429, {}, 'RATE_LIMITED', true],
  [500, {}, 'PROVIDER_UNAVAILABLE', true],
  [503, {}, 'PROVIDER_UNAVAILABLE', true],
  [
    409,
    { name: 'concurrent_idempotent_requests' },
    'IDEMPOTENCY_IN_PROGRESS',
    true,
  ],
  [409, { name: 'invalid_idempotent_request' }, 'IDEMPOTENCY_CONFLICT', false],
  [400, {}, 'PROVIDER_REJECTED', false],
  [401, {}, 'PROVIDER_REJECTED', false],
  [403, {}, 'PROVIDER_REJECTED', false],
  [422, {}, 'PROVIDER_REJECTED', false],
]) {
  test(`Resend ${status}/${code} is redacted and never automatically retried`, async () => {
    let calls = 0;
    const transport = createResendTransport('test-only-key', {
      fetch: async () => {
        calls++;
        return new Response(
          JSON.stringify({ ...body, message: 'private student@example.test' }),
          { status },
        );
      },
    });
    await assert.rejects(transport.send(payload, options()), (error) => {
      assert.equal(error.code, code);
      assert.equal(error.message, code);
      assert.equal(error.retryable, retryable);
      assert.equal(error.cause, undefined);
      assert.ok(!JSON.stringify(error).includes('private'));
      return true;
    });
    assert.equal(calls, 1);
  });
}

test('Retry-After supports seconds/HTTP dates and leaves excessive waits visible to policy', async () => {
  for (const [header, delay] of [
    ['120', 120_000],
    ['Sun, 01 Nov 2026 00:03:00 GMT', 180_000],
    ['21601', 21_601_000],
    [
      '999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999',
      Number.MAX_SAFE_INTEGER,
    ],
    ['malformed', undefined],
  ]) {
    const transport = createResendTransport('test-only-key', {
      fetch: async () =>
        new Response('{}', {
          status: 429,
          headers: {
            'Retry-After': header,
            Date: 'Sun, 01 Nov 2026 00:00:00 GMT',
          },
        }),
    });
    await assert.rejects(
      transport.send(payload, options()),
      (error) => error.retryAfterMs === delay,
    );
  }
});

test(
  '429 headers preserve Retry-After without waiting for a never-resolving body',
  { timeout: 1000 },
  async () => {
    let bodyReads = 0;
    let cancellations = 0;
    const transport = createResendTransport('test-only-key', {
      fetch: async () => ({
        status: 429,
        headers: new Headers({ 'Retry-After': '3600' }),
        body: {
          cancel: () => {
            cancellations++;
            return new Promise(() => {});
          },
        },
        json: () => {
          bodyReads++;
          return new Promise(() => {});
        },
      }),
    });
    await assert.rejects(transport.send(payload, options()), (error) => {
      assert.equal(error.code, 'RATE_LIMITED');
      assert.equal(error.retryable, true);
      assert.equal(error.retryAfterMs, 3_600_000);
      return true;
    });
    assert.equal(bodyReads, 0);
    assert.equal(cancellations, 1);
  },
);

for (const [label, response] of [
  [
    'unknown name',
    () =>
      new Response('{"name":"new_provider_condition","message":"private"}', {
        status: 409,
      }),
  ],
  ['missing name', () => new Response('{}', { status: 409 })],
  [
    'malformed JSON',
    () => new Response('private non-JSON response', { status: 409 }),
  ],
  ['null body', () => new Response('null', { status: 409 })],
  [
    'unreadable body',
    () => ({
      status: 409,
      json: async () => {
        throw new Error('private read failure');
      },
    }),
  ],
]) {
  test(`409 ${label} is retryable and redacted`, async () => {
    let calls = 0;
    const transport = createResendTransport('test-only-key', {
      fetch: async () => {
        calls++;
        return response();
      },
    });
    await assert.rejects(transport.send(payload, options()), (error) => {
      assert.equal(error.code, 'IDEMPOTENCY_UNKNOWN');
      assert.equal(error.retryable, true);
      assert.equal(error.cause, undefined);
      assert.ok(!error.message.includes('private'));
      assert.ok(!JSON.stringify(error).includes('private'));
      return true;
    });
    assert.equal(calls, 1);
  });
}

const databaseNow = Date.parse('2026-11-01T00:00:00Z');
function policyRow(overrides = {}) {
  return {
    notification_id: 42,
    payload_json: payload,
    idempotency_key: options().idempotencyKey,
    state: 'Processing',
    attempt_count: 1,
    next_attempt_at: new Date(databaseNow),
    first_attempt_at: new Date(databaseNow),
    lease_token: 'claim',
    lease_expires_at: new Date(databaseNow + 60_000),
    db_now: new Date(databaseNow),
    notification_type: 'Reminder',
    notification_user_id: 7,
    event_id: 1,
    event_user_id: 7,
    event_status: 'Upcoming',
    due_date: new Date(databaseNow + 72 * 3_600_000),
    remind_before: 72,
    reminded_at: new Date(databaseNow),
    user_id: 7,
    user_role: 'Student',
    recipient: 'student@example.test',
    ...overrides,
  };
}

async function rateLimit(headers) {
  const transport = createResendTransport('test-only-key', {
    fetch: async () => new Response(null, { status: 429, headers }),
  });
  try {
    await transport.send(payload, options());
  } catch (error) {
    assert.equal(error.code, 'RATE_LIMITED');
    return error;
  }
  assert.fail('Expected rate-limit failure');
}

for (const skew of [-300_000, 300_000]) {
  for (const providerDate of [
    'Sun, 01 Nov 2026 00:00:00 GMT',
    undefined,
    'invalid date',
    '123',
  ]) {
    test(`HTTP-date scheduling ignores app clock skew ${skew}, Date=${providerDate}`, async (t) => {
      t.mock.method(Date, 'now', () => databaseNow + skew);
      const headers = { 'Retry-After': 'Sun, 01 Nov 2026 00:02:00 GMT' };
      if (providerDate !== undefined) headers.Date = providerDate;
      const failure = await rateLimit(headers);
      if (providerDate === 'Sun, 01 Nov 2026 00:00:00 GMT') {
        assert.equal(failure.retryAfterMs, 120_000);
        assert.equal(failure.retryAtMs, undefined);
      } else {
        assert.equal(failure.retryAfterMs, undefined);
        assert.equal(failure.retryAtMs, databaseNow + 120_000);
      }
      const decision = retryDecision(policyRow(), failure);
      assert.equal(decision.state, 'Retry');
      assert.equal(+decision.nextAttemptAt, databaseNow + 120_000);
    });
  }
}

test('valid provider Date takes precedence over database/app wall-clock skew', async () => {
  const failure = await rateLimit({
    Date: 'Sun, 01 Nov 2026 00:05:00 GMT',
    'Retry-After': 'Sun, 01 Nov 2026 00:07:00 GMT',
  });
  assert.equal(failure.retryAfterMs, 120_000);
  assert.equal(
    +retryDecision(policyRow(), failure).nextAttemptAt,
    databaseNow + 120_000,
  );
});

test('HTTP-date boundary waits preserve normal backoff and the six-hour ceiling', async () => {
  for (const includeDate of [false, true]) {
    for (const delay of [
      -1000,
      0,
      29_000,
      30_000,
      31_000,
      MAX_RETRY_DELAY_MS,
      MAX_RETRY_DELAY_MS + 1000,
    ]) {
      const headers = {
        'Retry-After': new Date(databaseNow + delay).toUTCString(),
      };
      if (includeDate) headers.Date = new Date(databaseNow).toUTCString();
      const decision = retryDecision(policyRow(), await rateLimit(headers));
      if (delay > MAX_RETRY_DELAY_MS) {
        assert.equal(decision.state, 'Dead');
        assert.equal(decision.code, 'RETRY_AFTER_EXCEEDS_LIMIT');
      } else {
        assert.equal(decision.state, 'Retry');
        assert.equal(
          +decision.nextAttemptAt,
          databaseNow + Math.max(30_000, delay),
        );
      }
    }
  }
  const failure = await rateLimit({
    'Retry-After': 'Sun, 01 Nov 2026 00:00:31 GMT',
  });
  const rounded = retryDecision(
    policyRow({ db_now: new Date(databaseNow + 499) }),
    failure,
  );
  assert.equal(+rounded.nextAttemptAt, databaseNow + 31_000);
});

test('absolute Retry-After and unknown 409 retain attempt, deadline and idempotency limits', async () => {
  const rateLimited = await rateLimit({
    'Retry-After': 'Sun, 01 Nov 2026 00:02:00 GMT',
  });
  const transport = createResendTransport('test-only-key', {
    fetch: async () => new Response('{}', { status: 409 }),
  });
  let unknown;
  await assert.rejects(transport.send(payload, options()), (error) => {
    unknown = error;
    return error.retryable;
  });
  for (const failure of [rateLimited, unknown]) {
    assert.equal(
      retryDecision(policyRow({ attempt_count: 6 }), failure).code,
      'ATTEMPTS_EXHAUSTED',
    );
    assert.equal(
      retryDecision(
        policyRow({
          first_attempt_at: new Date(
            databaseNow - IDEMPOTENCY_WINDOW_MS + 20_000,
          ),
        }),
        failure,
      ).code,
      'IDEMPOTENCY_WINDOW_EXPIRED',
    );
    assert.equal(
      retryDecision(
        policyRow({
          due_date: new Date(databaseNow + 20_000),
        }),
        failure,
      ).state,
      'Cancelled',
    );
  }
});

test('network, malformed successes and aborts remain ambiguous, redacted failures', async () => {
  for (const fetch of [
    async () => {
      throw new Error('private provider/network data');
    },
    async () => new Response('not JSON', { status: 200 }),
    async () => new Response('{"id":"private\\n"}', { status: 200 }),
  ]) {
    const transport = createResendTransport('test-only-key', { fetch });
    await assert.rejects(transport.send(payload, options()), (error) => {
      assert.ok(error.retryable);
      assert.ok(!error.message.includes('private'));
      return true;
    });
  }
  let calls = 0;
  const transport = createResendTransport('test-only-key', {
    fetch: async () => {
      calls++;
      throw new Error('must not run');
    },
  });
  const signal = AbortSignal.abort();
  await assert.rejects(transport.send(payload, { ...options(), signal }), {
    code: 'REQUEST_TIMEOUT',
  });
  assert.equal(calls, 0);
  assert.throws(() => createResendTransport(''), /PROVIDER_CONFIG_INVALID/);
});

test('Gmail SMTP adapter sends mail with payload, adds X-Idempotency-Key and extracts providerEmailId', async () => {
  const calls = [];
  const fakeTransporter = {
    sendMail: async (mailOptions) => {
      calls.push(mailOptions);
      return { messageId: '<synthetic-msg-12345@gmail.com>' };
    },
  };
  const transport = createGmailSmtpTransport(
    { user: 'sender@example.test', pass: 'secret-app-password' },
    { transporter: fakeTransporter },
  );
  const result = await transport.send(payload, options());
  assert.equal(result.providerEmailId, 'synthetic-msg-12345_gmail_com');
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].from, {
    name: 'UniHub',
    address: 'sender@example.test',
  });
  assert.deepEqual(calls[0].to, ['student@example.test']);
  assert.equal(calls[0].subject, 'Reminder');
  assert.equal(calls[0].headers['X-Idempotency-Key'], options().idempotencyKey);
});

test('Gmail SMTP uses custom sender name when provided in credentials', async () => {
  const calls = [];
  const fakeTransporter = {
    sendMail: async (mailOptions) => {
      calls.push(mailOptions);
      return { messageId: '<custom-msg-999@gmail.com>' };
    },
  };
  const transport = createGmailSmtpTransport(
    {
      user: 'sender@example.test',
      pass: 'secret-app-password',
      fromName: 'UniHub Notifications',
    },
    { transporter: fakeTransporter },
  );
  await transport.send(payload, options());
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].from, {
    name: 'UniHub Notifications',
    address: 'sender@example.test',
  });
});

test('Gmail SMTP rejects invalid credentials configuration without leaking values', () => {
  for (const creds of [
    { user: '', pass: 'app-password' },
    { user: 'not-an-email', pass: 'app-password' },
    { user: 'sender@example.test', pass: '' },
    { user: 'sender@example.test', pass: 'short' },
  ]) {
    assert.throws(
      () => createGmailSmtpTransport(creds),
      /REMINDER_EMAIL_PROVIDER_CONFIG_INVALID/,
    );
  }
});

test('Gmail SMTP maps SMTP errors to redacted MailFailure without leaking details', async () => {
  for (const [err, expectedCode, expectedRetryable] of [
    [
      { responseCode: 535, message: '5.7.8 Bad credentials private-pass' },
      'PROVIDER_REJECTED',
      false,
    ],
    [
      { responseCode: 550, message: '5.1.1 User not found private@email.com' },
      'PROVIDER_REJECTED',
      false,
    ],
    [
      { responseCode: 421, message: '4.7.0 Try again later' },
      'RATE_LIMITED',
      true,
    ],
    [
      { responseCode: 450, message: '4.2.1 Mailbox busy' },
      'RATE_LIMITED',
      true,
    ],
    [
      { responseCode: 452, message: '4.2.2 Daily sending limit exceeded' },
      'RATE_LIMITED',
      true,
    ],
    [
      { responseCode: 400, message: '4.0.0 Temporary failure' },
      'PROVIDER_UNAVAILABLE',
      true,
    ],
    [
      { code: 'ETIMEDOUT', message: 'connection timed out' },
      'REQUEST_TIMEOUT',
      true,
    ],
    [
      { code: 'ECONNREFUSED', message: 'connection refused' },
      'NETWORK_ERROR',
      true,
    ],
  ]) {
    const transport = createGmailSmtpTransport(
      { user: 'sender@example.test', pass: 'secret-app-password' },
      {
        transporter: {
          sendMail: async () => {
            throw err;
          },
        },
      },
    );
    await assert.rejects(transport.send(payload, options()), (error) => {
      assert.equal(error.code, expectedCode);
      assert.equal(error.retryable, expectedRetryable);
      assert.ok(!error.message.includes('private'));
      return true;
    });
  }
});

test('Gmail SMTP abort signal cancels send with REQUEST_TIMEOUT', async () => {
  const signal = AbortSignal.abort();
  const transport = createGmailSmtpTransport(
    { user: 'sender@example.test', pass: 'secret-app-password' },
    {
      transporter: {
        sendMail: async () => new Promise(() => {}),
      },
    },
  );
  await assert.rejects(transport.send(payload, { ...options(), signal }), {
    code: 'REQUEST_TIMEOUT',
  });
});
