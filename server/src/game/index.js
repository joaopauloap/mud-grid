import { init as dbInit } from "../database/db.js";
import { UserRepository } from "../repositories/userRepository.js";
import { WorldRepository } from "../repositories/worldRepository.js";
import { RoleRepository } from "../repositories/roleRepository.js";
import { NpcRepository } from "../repositories/npcRepository.js";
import { NpcDialogRepository } from "../repositories/npcDialogRepository.js";
import { DialogTreeRepository } from "../repositories/dialogTreeRepository.js";
import { AuthService } from "../services/authService.js";

export async function init() {
    await dbInit();
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

// --- NPC Dialog Functions ---

export async function setNpcDialog(npcId, trigger, response) {
    return await NpcDialogRepository.setDialog(npcId, trigger, response);
}

export async function getNpcDialog(npcId, trigger) {
    return await NpcDialogRepository.getDialog(npcId, trigger);
}

export async function getAllNpcDialogs(npcId) {
    return await NpcDialogRepository.getAllDialogs(npcId);
}

export async function deleteNpcDialog(npcId, trigger) {
    return await NpcDialogRepository.deleteDialog(npcId, trigger);
}

export async function findNpcResponse(npcId, playerText) {
    return await NpcDialogRepository.findResponse(npcId, playerText);
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
