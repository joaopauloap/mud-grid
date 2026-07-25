import fs from "fs";
import path from "path";
import { init as dbInit } from "../database/db.js";
import { UserRepository } from "../repositories/userRepository.js";
import { WorldRepository } from "../repositories/worldRepository.js";
import { RoleRepository } from "../repositories/roleRepository.js";
import { NpcRepository } from "../repositories/npcRepository.js";
import { DialogTreeRepository } from "../repositories/dialogTreeRepository.js";
import { AuthService } from "../services/authService.js";

const NPC_DATA_DIR = path.resolve(process.cwd(), "data", "npcs");
const PLACES_DATA_DIR = path.resolve(process.cwd(), "data", "places");

export async function init() {
    await dbInit();
    await seedPlacesFromJson();
    await seedNpcsFromJson();
}

// ==================== Places Seed via JSON ====================

async function seedPlacesFromJson() {
    const filePath = path.join(PLACES_DATA_DIR, "places.json");
    let raw;
    try {
        raw = fs.readFileSync(filePath, "utf-8");
    } catch {
        console.warn("[seed] Aviso: data/places/places.json não encontrado. Pulando seed de lugares.");
        return;
    }

    let places;
    try {
        places = JSON.parse(raw);
    } catch (err) {
        console.warn(`[seed] Aviso: places.json inválido: ${err.message}`);
        return;
    }

    if (!Array.isArray(places) || places.length === 0) {
        console.warn("[seed] Aviso: places.json vazio ou sem array.");
        return;
    }

    // Só faz seed se a tabela estiver vazia
    const count = await WorldRepository.getWorldCount();
    if (count > 0) {
        return;
    }

    try {
        await WorldRepository.seedWorld(places);
        console.log(`[seed] ${places.length} lugar(es) do mundo importado(s) de places.json.`);
    } catch (err) {
        console.error(`[seed] Erro ao importar lugares: ${err.message}`);
    }
}

// ==================== NPC Seed via JSON ====================

/**
 * Lê todos os arquivos .json do diretório data/npcs/ e importa
 * NPCs que ainda não existam no banco (verifica pelo nome).
 */
async function seedNpcsFromJson() {
    let files;
    try {
        files = fs.readdirSync(NPC_DATA_DIR).filter(f => f.endsWith('.json'));
    } catch {
        // Diretório não existe — nada a seedar
        return;
    }

    for (const file of files) {
        const filePath = path.join(NPC_DATA_DIR, file);
        let raw;
        try {
            raw = fs.readFileSync(filePath, 'utf-8');
        } catch {
            console.warn(`[seed] Aviso: não foi possível ler ${filePath}`);
            continue;
        }

        let data;
        try {
            data = JSON.parse(raw);
        } catch (err) {
            console.warn(`[seed] Aviso: JSON inválido em ${file}: ${err.message}`);
            continue;
        }

        if (!data || !data.name) {
            console.warn(`[seed] Aviso: ${file} não possui "name". Ignorado.`);
            continue;
        }

        // Verifica se já existe
        const existing = await NpcRepository.getNpcByName(data.name);
        if (existing) {
            // console.log(`[seed] NPC '${data.name}' já existe (ID: ${existing.id}). Pulando.`);
            continue;
        }

        const x = data.x !== undefined ? data.x : 0;
        const y = data.y !== undefined ? data.y : 0;

        try {
            const npc = await NpcRepository.createNpc({ name: data.name, x, y });
            console.log(`[seed] NPC '${npc.name}' criado (ID: ${npc.id}) em (${npc.x}, ${npc.y}).`);

            if (data.dialogTree && data.dialogTree.name) {
                const tree = await DialogTreeRepository.createTree(npc.id, data.dialogTree.name);
                console.log(`[seed] Árvore '${tree.name}' criada para '${data.name}'.`);

                if (data.dialogTree.nodes && data.dialogTree.nodes.length > 0) {
                    let totalNodes = 0;
                    for (const rootNode of data.dialogTree.nodes) {
                        totalNodes += await importDialogNodeFromJson(tree.id, null, rootNode);
                    }
                    console.log(`[seed] ${totalNodes} nó(s) de diálogo importados para '${data.name}'.`);
                }
            }
        } catch (err) {
            console.error(`[seed] Erro ao importar NPC '${data.name}' de ${file}: ${err.message}`);
        }
    }
}

/**
 * Importa recursivamente um nó de diálogo a partir de objeto JSON.
 */
async function importDialogNodeFromJson(treeId, parentId, nodeData) {
    const trigger = (nodeData.trigger || '').toLowerCase();
    const response = nodeData.response || '';
    const hint = nodeData.hint || null;

    let flags = '';
    if (nodeData.flags) {
        flags = Array.isArray(nodeData.flags) ? nodeData.flags.join(',') : String(nodeData.flags);
    }

    let conditionType = null;
    let conditionValue = null;
    if (nodeData.condition) {
        conditionType = nodeData.condition.type || null;
        conditionValue = nodeData.condition.value || null;
    }

    let actionsJson = '[]';
    if (nodeData.actions && Array.isArray(nodeData.actions)) {
        actionsJson = JSON.stringify(nodeData.actions);
    }

    const node = await DialogTreeRepository.addNode(treeId, parentId, trigger, response, {
        hint,
        sortOrder: nodeData.sortOrder || 0,
        flags,
        conditionType,
        conditionValue
    });

    if (actionsJson !== '[]') {
        await DialogTreeRepository.updateNodeActions(node.id, actionsJson);
    }

    let count = 1;

    if (nodeData.children && Array.isArray(nodeData.children)) {
        for (const childData of nodeData.children) {
            count += await importDialogNodeFromJson(treeId, node.id, childData);
        }
    }

    return count;
}

export async function createUser(username, password) {
    return await AuthService.createUser(username, password);
}

export async function authenticate(username, password) {
    return await AuthService.authenticate(username, password);
}

export async function userExists(username) {
    return await UserRepository.userExists(username);
}

export async function getGameParam(key) {
    return await WorldRepository.getGameParam(key);
}

export async function getLocation(username) {
    return await UserRepository.getLocation(username);
}

export async function savePlayerLocation(username, location) {
    return await UserRepository.savePlayerLocation(username, location);
}

export async function getAllWorldDescriptions() {
    return await WorldRepository.getAllWorldDescriptions();
}

export async function getWorldCount() {
    return await WorldRepository.getWorldCount();
}

export async function seedWorld(rows) {
    return await WorldRepository.seedWorld(rows);
}

export async function saveWorldDescription(location) {
    return await WorldRepository.saveWorldDescription(location);
}

export async function deleteWorldDescription(x, y) {
    return await WorldRepository.deleteWorldDescription(x, y);
}

export async function createWorldObject(object) {
    return await WorldRepository.createWorldObject(object);
}

export async function getAllWorldObjects() {
    return await WorldRepository.getAllWorldObjects();
}

export async function getWorldObjectsByLocation(x, y) {
    return await WorldRepository.getWorldObjectsByLocation(x, y);
}

export async function getWorldObjectById(id) {
    return await WorldRepository.getWorldObjectById(id);
}

export async function updateWorldObjectLocation(id, x, y) {
    return await WorldRepository.updateWorldObjectLocation(id, x, y);
}

export async function seedWorldObjects(objects) {
    return await WorldRepository.seedWorldObjects(objects);
}

export async function getWorldObjectCount() {
    return await WorldRepository.getWorldObjectCount();
}

export async function deleteWorldObjectById(id) {
    return await WorldRepository.deleteWorldObjectById(id);
}

export async function getWorldObjectsByKeyword(keyword) {
    return await WorldRepository.getWorldObjectsByKeyword(keyword);
}

export async function createRole(name) {
    return await RoleRepository.createRole(name);
}

export async function getAllRoles() {
    return await RoleRepository.getAllRoles();
}

export async function deleteRole(name) {
    return await RoleRepository.deleteRole(name);
}

export async function seedRoles(names) {
    return await RoleRepository.seedRoles(names);
}

export async function assignRole(username, role) {
    return await RoleRepository.assignRole(username, role);
}

export async function removeRole(username, role) {
    return await RoleRepository.removeRole(username, role);
}

export async function hasRole(username, role) {
    return await RoleRepository.hasRole(username, role);
}

export async function getUserRoles(username) {
    return await RoleRepository.getUserRoles(username);
}

export async function getAllUsers() {
    return await UserRepository.getAllUsers();
}

// --- NPC Functions ---

export async function createNpc({ name, x, y }) {
    return await NpcRepository.createNpc({ name, x, y });
}

export async function deleteNpc(id) {
    return await NpcRepository.deleteNpc(id);
}

export async function getAllNpcs() {
    return await NpcRepository.getAllNpcs();
}

export async function getNpcsByLocation(x, y) {
    return await NpcRepository.getNpcsByLocation(x, y);
}

export async function getNpcById(id) {
    return await NpcRepository.getNpcById(id);
}

export async function getNpcByName(name) {
    return await NpcRepository.getNpcByName(name);
}

export async function updateNpcLocation(id, x, y) {
    return await NpcRepository.updateNpcLocation(id, x, y);
}

// --- Dialog Tree Functions ---

export async function createDialogTree(npcId, name) {
    return await DialogTreeRepository.createTree(npcId, name);
}

export async function getDialogTreeByNpcId(npcId) {
    return await DialogTreeRepository.getTreeByNpcId(npcId);
}

export async function getDialogTreeById(treeId) {
    return await DialogTreeRepository.getTreeById(treeId);
}

export async function deleteDialogTreeByNpcId(npcId) {
    return await DialogTreeRepository.deleteTreeByNpcId(npcId);
}

export async function addDialogNode(treeId, parentId, trigger, npcResponse, opts) {
    return await DialogTreeRepository.addNode(treeId, parentId, trigger, npcResponse, opts);
}

export async function getDialogTreeNodes(treeId) {
    return await DialogTreeRepository.getTreeNodes(treeId);
}

export async function getDialogRootNodes(treeId) {
    return await DialogTreeRepository.getRootNodes(treeId);
}

export async function getDialogChildNodes(nodeId) {
    return await DialogTreeRepository.getChildNodes(nodeId);
}

export async function findDialogChildByTrigger(parentNodeId, playerText) {
    return await DialogTreeRepository.findChildByTrigger(parentNodeId, playerText);
}

export async function getDialogNodeById(nodeId) {
    return await DialogTreeRepository.getNodeById(nodeId);
}

export async function updateDialogNodeTrigger(nodeId, newTrigger) {
    return await DialogTreeRepository.updateNodeTrigger(nodeId, newTrigger);
}

export async function updateDialogNodeResponse(nodeId, newResponse) {
    return await DialogTreeRepository.updateNodeResponse(nodeId, newResponse);
}

export async function updateDialogNodeHint(nodeId, hint) {
    return await DialogTreeRepository.updateNodeHint(nodeId, hint);
}

export async function updateDialogNodeFlags(nodeId, flags) {
    return await DialogTreeRepository.updateNodeFlags(nodeId, flags);
}

export async function updateDialogNodeCondition(nodeId, conditionType, conditionValue) {
    return await DialogTreeRepository.updateNodeCondition(nodeId, conditionType, conditionValue);
}

export async function updateDialogNodeActions(nodeId, actionCommandsJson) {
    return await DialogTreeRepository.updateNodeActions(nodeId, actionCommandsJson);
}

export async function deleteDialogNode(nodeId) {
    return await DialogTreeRepository.deleteNode(nodeId);
}

export async function findDialogNodeByTrigger(treeId, trigger) {
    return await DialogTreeRepository.findNodeByTrigger(treeId, trigger);
}

export async function getDialogTreeAsText(treeId) {
    return await DialogTreeRepository.getTreeAsText(treeId);
}
