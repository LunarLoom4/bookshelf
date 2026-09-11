/**
 * PasswordStrength
 * Visual strength indicator shown below password fields during registration.
 * Checks the same rules as the backend validator.
 */

interface Props {
  password: string;
}

interface Check {
  label: string;
  pass: boolean;
}

function getChecks(password: string): Check[] {
  return [
    { label: "At least 8 characters", pass: password.length >= 8 },
    { label: "Uppercase letter (A-Z)", pass: /[A-Z]/.test(password) },
    { label: "Lowercase letter (a-z)", pass: /[a-z]/.test(password) },
    { label: "Number (0-9)", pass: /\d/.test(password) },
    { label: "Special character (!@#$%^&* etc.)", pass: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password) },
  ];
}

function getStrength(checks: Check[]): { level: number; label: string; color: string } {
  const passed = checks.filter((c) => c.pass).length;
  if (passed <= 1) return { level: 1, label: "Very weak", color: "bg-red-500" };
  if (passed === 2) return { level: 2, label: "Weak", color: "bg-orange-400" };
  if (passed === 3) return { level: 3, label: "Fair", color: "bg-yellow-400" };
  if (passed === 4) return { level: 4, label: "Strong", color: "bg-blue-500" };
  return { level: 5, label: "Very strong", color: "bg-green-500" };
}

export function PasswordStrength({ password }: Props) {
  if (!password) return null;

  const checks = getChecks(password);
  const strength = getStrength(checks);
  const allPassed = checks.every((c) => c.pass);

  return (
    <div className="mt-2 flex flex-col gap-2">
      {/* Strength bar */}
      <div className="flex items-center gap-2">
        <div className="flex gap-1 flex-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors duration-200 ${
                i <= strength.level ? strength.color : "bg-gray-200"
              }`}
            />
          ))}
        </div>
        <span className={`text-xs font-medium w-20 text-right ${
          strength.level <= 2 ? "text-red-500" :
          strength.level === 3 ? "text-yellow-600" :
          strength.level === 4 ? "text-blue-600" : "text-green-600"
        }`}>
          {strength.label}
        </span>
      </div>

      {/* Requirements checklist -- only show until all pass */}
      {!allPassed && (
        <ul className="flex flex-col gap-1">
          {checks.map((check) => (
            <li key={check.label} className="flex items-center gap-1.5 text-xs">
              <span className={check.pass ? "text-green-500" : "text-gray-400"}>
                {check.pass ? "✓" : "○"}
              </span>
              <span className={check.pass ? "text-green-600" : "text-gray-500"}>
                {check.label}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
