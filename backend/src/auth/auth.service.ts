import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const usersFile = path.resolve(__dirname, "../../data/users.json");

export type UserPlan = "free" | "pro_placeholder" | "enterprise_placeholder";

export interface UserAccount {
  id: string;
  email: string;
  name: string;
  passwordHash: string; // salt:derivedKey format
  plan: UserPlan;
  createdAt: string;
  scansThisMonth: number;
  maxMonthlyScans: number;
  lastResetMonth: string; // YYYY-MM
}

export interface AuthTokenPayload {
  sub: string;
  email: string;
  name: string;
  plan: UserPlan;
  iat: number;
  exp: number;
}

export class AuthService {
  private static instance: AuthService;
  private users = new Map<string, UserAccount>(); // email -> UserAccount
  private usersById = new Map<string, UserAccount>(); // id -> UserAccount
  private jwtSecret: string;

  private constructor() {
    this.jwtSecret = process.env.JWT_SECRET || "sitedoctor-development-jwt-secret-key-32-chars-min";
    this.loadFromDisk();
  }

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(usersFile)) {
        const raw = fs.readFileSync(usersFile, "utf-8");
        const list: UserAccount[] = JSON.parse(raw);
        for (const u of list) {
          this.checkAndResetMonthlyQuota(u);
          this.users.set(u.email.toLowerCase(), u);
          this.usersById.set(u.id, u);
        }
      }
    } catch {
      // In-memory fallback
    }
  }

  private saveToDisk(): void {
    try {
      fs.mkdirSync(path.dirname(usersFile), { recursive: true });
      const list = Array.from(this.users.values());
      fs.writeFileSync(usersFile, JSON.stringify(list, null, 2), "utf-8");
    } catch {
      // Best effort
    }
  }

  private getCurrentMonthKey(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }

  private checkAndResetMonthlyQuota(user: UserAccount): void {
    const currentMonth = this.getCurrentMonthKey();
    if (user.lastResetMonth !== currentMonth) {
      user.scansThisMonth = 0;
      user.lastResetMonth = currentMonth;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PASSWORD HASHING (Scrypt + Salt)
  // ─────────────────────────────────────────────────────────────────────────
  public hashPassword(password: string): string {
    const salt = crypto.randomBytes(16).toString("hex");
    const derivedKey = crypto.scryptSync(password, salt, 64).toString("hex");
    return `${salt}:${derivedKey}`;
  }

  public verifyPassword(password: string, storedHash: string): boolean {
    try {
      const [salt, key] = storedHash.split(":");
      if (!salt || !key) return false;
      const keyBuffer = Buffer.from(key, "hex");
      const derivedKey = crypto.scryptSync(password, salt, 64);
      return crypto.timingSafeEqual(keyBuffer, derivedKey);
    } catch {
      return false;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // JWT TOKEN GENERATION & VERIFICATION (HMAC-SHA256)
  // ─────────────────────────────────────────────────────────────────────────
  public generateToken(user: UserAccount): string {
    const now = Math.floor(Date.now() / 1000);
    const payload: AuthTokenPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      plan: user.plan,
      iat: now,
      exp: now + (7 * 24 * 60 * 60) // 7 days validity
    };

    const header = { alg: "HS256", typ: "JWT" };
    const b64Header = Buffer.from(JSON.stringify(header)).toString("base64url");
    const b64Payload = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signature = crypto
      .createHmac("sha256", this.jwtSecret)
      .update(`${b64Header}.${b64Payload}`)
      .digest("base64url");

    return `${b64Header}.${b64Payload}.${signature}`;
  }

  public verifyToken(token: string): AuthTokenPayload | null {
    try {
      const parts = token.split(".");
      if (parts.length !== 3) return null;
      const [b64Header, b64Payload, signature] = parts;
      if (!b64Header || !b64Payload || !signature) return null;

      const expectedSignature = crypto
        .createHmac("sha256", this.jwtSecret)
        .update(`${b64Header}.${b64Payload}`)
        .digest("base64url");

      if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
        return null;
      }

      const payload: AuthTokenPayload = JSON.parse(Buffer.from(b64Payload, "base64url").toString("utf-8"));
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp < now) {
        return null;
      }

      return payload;
    } catch {
      return null;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // USER MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────
  public signup(params: { email: string; password: string; name?: string }): {
    user: Omit<UserAccount, "passwordHash">;
    token: string;
  } {
    const emailNorm = params.email.trim().toLowerCase();
    if (this.users.has(emailNorm)) {
      throw new Error("An account with this email address already exists.");
    }

    if (params.password.length < 8) {
      throw new Error("Password must be at least 8 characters long.");
    }

    const id = `usr_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    const user: UserAccount = {
      id,
      email: emailNorm,
      name: params.name?.trim() || emailNorm.split("@")[0] || "User",
      passwordHash: this.hashPassword(params.password),
      plan: "free",
      createdAt: new Date().toISOString(),
      scansThisMonth: 0,
      maxMonthlyScans: 10, // Free tier quota
      lastResetMonth: this.getCurrentMonthKey()
    };

    this.users.set(emailNorm, user);
    this.usersById.set(id, user);
    this.saveToDisk();

    const token = this.generateToken(user);
    const { passwordHash, ...safeUser } = user;
    return { user: safeUser, token };
  }

  public login(params: { email: string; password: string }): {
    user: Omit<UserAccount, "passwordHash">;
    token: string;
  } {
    const emailNorm = params.email.trim().toLowerCase();
    const user = this.users.get(emailNorm);

    if (!user || !this.verifyPassword(params.password, user.passwordHash)) {
      throw new Error("Invalid email or password.");
    }

    this.checkAndResetMonthlyQuota(user);
    const token = this.generateToken(user);
    const { passwordHash, ...safeUser } = user;
    return { user: safeUser, token };
  }

  public getUserById(id: string): Omit<UserAccount, "passwordHash"> | null {
    const user = this.usersById.get(id);
    if (!user) return null;
    this.checkAndResetMonthlyQuota(user);
    const { passwordHash, ...safeUser } = user;
    return safeUser;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // QUOTA & SCAN USAGE ENFORCEMENT
  // ─────────────────────────────────────────────────────────────────────────
  public checkScanAllowance(userId: string): {
    allowed: boolean;
    reason?: string;
    usage: {
      plan: UserPlan;
      scansThisMonth: number;
      maxMonthlyScans: number;
      remainingScans: number;
    };
  } {
    // If anonymous, allow within IP rate limits
    if (userId === "anonymous" || !userId) {
      return {
        allowed: true,
        usage: {
          plan: "free",
          scansThisMonth: 0,
          maxMonthlyScans: 5,
          remainingScans: 5
        }
      };
    }

    const user = this.usersById.get(userId);
    if (!user) {
      return {
        allowed: true,
        usage: {
          plan: "free",
          scansThisMonth: 0,
          maxMonthlyScans: 10,
          remainingScans: 10
        }
      };
    }

    this.checkAndResetMonthlyQuota(user);

    if (user.scansThisMonth >= user.maxMonthlyScans) {
      return {
        allowed: false,
        reason: `Monthly scan quota exceeded (${user.scansThisMonth}/${user.maxMonthlyScans} used). Quota resets at the start of next month.`,
        usage: {
          plan: user.plan,
          scansThisMonth: user.scansThisMonth,
          maxMonthlyScans: user.maxMonthlyScans,
          remainingScans: 0
        }
      };
    }

    return {
      allowed: true,
      usage: {
        plan: user.plan,
        scansThisMonth: user.scansThisMonth,
        maxMonthlyScans: user.maxMonthlyScans,
        remainingScans: user.maxMonthlyScans - user.scansThisMonth
      }
    };
  }

  public recordScan(userId: string): void {
    if (userId === "anonymous" || !userId) return;
    const user = this.usersById.get(userId);
    if (user) {
      this.checkAndResetMonthlyQuota(user);
      user.scansThisMonth += 1;
      this.saveToDisk();
    }
  }
}
