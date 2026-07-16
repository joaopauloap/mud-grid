import crypto from "crypto";
import { UserRepository } from "../repositories/userRepository.js";
import { RoleRepository } from "../repositories/roleRepository.js";

export class AuthService {
    static hashPassword(password, salt) {
        return crypto.scryptSync(password, salt, 64).toString("hex");
    }

    static async createUser(username, password) {
        const existing = await UserRepository.userExists(username);
        if (existing) throw new Error("Usuário já existe");

        const salt = crypto.randomBytes(16).toString("hex");
        const passwordHash = AuthService.hashPassword(password, salt);

        await UserRepository.createUserRow(username, passwordHash, salt);
        // assign default role
        await RoleRepository.assignRole(username, 'user').catch(() => { });
        return true;
    }

    static async authenticate(username, password) {
        const user = await UserRepository.getUser(username);
        if (!user) return false;

        const computed = AuthService.hashPassword(password, user.salt);
        const a = Buffer.from(computed, "hex");
        const b = Buffer.from(user.password_hash, "hex");

        if (a.length !== b.length) return false;

        return crypto.timingSafeEqual(a, b);
    }
}
