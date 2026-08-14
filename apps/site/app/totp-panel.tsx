"use client";

/**
 * A time-based one-time password utility.
 *
 * This is a standards utility only. This site has no accounts, so the code it
 * produces is bound to nothing here and grants access to nothing. The QR image
 * is drawn from the kernel's own encoder as inline SVG: there is no external
 * image, no content delivery network and no network access of any kind.
 */

import {
  TOTP_ALGORITHM,
  TOTP_DIGITS,
  TOTP_PERIOD_SECONDS,
  currentTotp,
  encodeQrMatrix,
  generateTotpSecret,
  totpCounter,
  totpUri,
  verifyTotp,
} from "@material-tax-reporting/surface-kernel";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";

const QUIET_ZONE = 4;

function QrImage({ text, label }: { text: string; label: string }): ReactNode {
  const matrix = useMemo(() => {
    try {
      return encodeQrMatrix(text);
    } catch {
      return null;
    }
  }, [text]);

  if (matrix === null) {
    return <p role="status">This value could not be encoded as a QR image in this browser.</p>;
  }

  const size = matrix.length + QUIET_ZONE * 2;
  return (
    <svg
      className="qr-image"
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
    >
      <rect width={size} height={size} fill="#ffffff" />
      {matrix.map((row, y) =>
        row.map((filled, x) =>
          filled ? (
            <rect key={`${x}-${y}`} x={x + QUIET_ZONE} y={y + QUIET_ZONE} width={1} height={1} fill="#000000" />
          ) : null,
        ),
      )}
    </svg>
  );
}

export function AuthenticatorPanel({
  secret,
  onSecretChange,
  onNotify,
}: {
  secret: string | null;
  onSecretChange: (secret: string | null) => void;
  onNotify: (kind: "success" | "error", title: string, body: string) => void;
}): ReactNode {
  const [now, setNow] = useState(() => Date.now());
  const [codes, setCodes] = useState<{ current: string; next: string } | null>(null);
  const [candidate, setCandidate] = useState("");
  const [verifyResult, setVerifyResult] = useState<string>("No code has been checked yet.");

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const counter = secret === null ? null : totpCounter(now);

  useEffect(() => {
    if (secret === null) {
      setCodes(null);
      return;
    }
    let cancelled = false;
    void Promise.all([currentTotp(secret, now), currentTotp(secret, now + TOTP_PERIOD_SECONDS * 1000)])
      .then(([current, next]) => {
        if (!cancelled) setCodes({ current, next });
      })
      .catch(() => {
        if (!cancelled) setCodes(null);
      });
    return () => {
      cancelled = true;
    };
    // `counter` changes once per period, which is exactly how often a code changes.
  }, [secret, counter]); // eslint-disable-line react-hooks/exhaustive-deps

  const secondsRemaining =
    TOTP_PERIOD_SECONDS - (Math.floor(now / 1000) % TOTP_PERIOD_SECONDS);

  const create = useCallback(() => {
    try {
      onSecretChange(generateTotpSecret());
      onNotify("success", "Shared secret created", "The secret was generated in this browser and stored locally.");
    } catch (error) {
      onNotify(
        "error",
        "Shared secret not created",
        error instanceof Error ? error.message : "A Web Cryptography implementation was not available.",
      );
    }
  }, [onNotify, onSecretChange]);

  return (
    <section className="utility-panel" id="authenticator-panel" tabIndex={-1} aria-labelledby="authenticator-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Local standards utility</p>
          <h2 id="authenticator-title">Authenticator utility</h2>
          <p>
            This site has no accounts. The secret below is bound to no account here, it grants access to
            nothing, and nothing is transmitted. Parameters are fixed at {TOTP_ALGORITHM}, {TOTP_DIGITS} digits
            and a {TOTP_PERIOD_SECONDS} second period.
          </p>
        </div>
      </div>

      {secret === null ? (
        <button type="button" className="filled-button" onClick={create}>
          Create a shared secret in this browser
        </button>
      ) : (
        <div className="totp-grid">
          <div>
            <QrImage
              text={totpUri({ issuer: "Material Tax Reporting", account: "local utility", secret })}
              label="QR image of the shared secret for an authenticator application"
            />
          </div>
          <div>
            <p className="field-label">Shared secret</p>
            <code className="totp-secret">{secret}</code>
            <p className="field-label">Current code</p>
            <output className="totp-code" aria-live="off">
              {codes?.current ?? "······"}
            </output>
            <p role="status" aria-live="polite">
              {secondsRemaining} second{secondsRemaining === 1 ? "" : "s"} until this code changes.
            </p>
            <p className="field-label">Next code</p>
            <output className="totp-code next">{codes?.next ?? "······"}</output>
            <label className="field-label" htmlFor="totp-verify">
              Check a code
            </label>
            <input
              id="totp-verify"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={candidate}
              maxLength={TOTP_DIGITS}
              onChange={(event) => setCandidate(event.target.value.replace(/\D/g, ""))}
            />
            <button
              type="button"
              className="outlined-button"
              onClick={() => {
                void verifyTotp(secret, candidate, Date.now())
                  .then((accepted) =>
                    setVerifyResult(
                      accepted
                        ? "The code was accepted, allowing one period of clock drift on either side."
                        : "The code was not accepted.",
                    ),
                  )
                  .catch((error: unknown) =>
                    setVerifyResult(
                      error instanceof Error ? error.message : "The code could not be checked.",
                    ),
                  );
              }}
            >
              Check this code
            </button>
            <p role="status">{verifyResult}</p>
            <button
              type="button"
              className="text-button"
              onClick={() => {
                onSecretChange(null);
                setCodes(null);
                setVerifyResult("No code has been checked yet.");
              }}
            >
              Remove the secret from this browser
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
