import { UserRepository } from "../repositories/userRepository.js";
import { WorldRepository } from "../repositories/worldRepository.js";
import { playersAtLocation } from "../game/locationManager.js";
import { descriptions, movePosition, saveLocationData, lookLocation } from "../map/index.js";

export class GameService {
    /**
     * Move um jogador em uma direção, atualizando memória e banco de dados.
     */
    static async movePlayer(player, directionKey) {
        if (!player.location) {
            throw new Error("Posição do jogador desconhecida.");
        }

        const oldLocation = { ...player.location };
        const newLocation = movePosition(player.location, directionKey);

        // Atualiza em memória temporariamente
        player.location = newLocation;

        try {
            // Persiste no banco
            await UserRepository.savePlayerLocation(player.name, {
                x: newLocation.x,
                y: newLocation.y,
                inventory: player.inventory || []
            });
            return { oldLocation, newLocation };
        } catch (err) {
            // Rollback em memória em caso de falha no banco
            player.location = oldLocation;
            throw err;
        }
    }

    /**
     * Transfere um jogador para coordenadas específicas.
     */
    static async transferPlayer(targetPlayer, destination) {
        const oldLocation = targetPlayer.location ? { ...targetPlayer.location } : null;
        targetPlayer.location = destination;

        try {
            await UserRepository.savePlayerLocation(targetPlayer.name, {
                x: destination.x,
                y: destination.y,
                inventory: targetPlayer.inventory || []
            });
            return { oldLocation, destination };
        } catch (err) {
            // Rollback
            if (oldLocation) targetPlayer.location = oldLocation;
            throw err;
        }
    }

    /**
     * Transfere um item físico do chão para outra coordenada do chão.
     */
    static async transferItemToLocation(item, sourceLocation, destLocation) {
        const sourceKey = `${sourceLocation.x},${sourceLocation.y}`;
        const destKey = `${destLocation.x},${destLocation.y}`;

        const sourceData = descriptions.get(sourceKey);
        const destData = descriptions.get(destKey) || {
            city: "Grade",
            place: "Local desconhecido",
            environment: "Área sem descrição",
            description: "Este local ainda não foi descrito.",
            objects: []
        };

        if (!descriptions.has(destKey)) {
            descriptions.set(destKey, destData);
        }

        // Remover da origem (memória)
        let removedItem = null;
        if (sourceData && sourceData.objects) {
            const index = sourceData.objects.findIndex(obj => String(obj.id) === String(item.id));
            if (index !== -1) {
                [removedItem] = sourceData.objects.splice(index, 1);
            }
        }

        // Adicionar ao destino (memória)
        destData.objects = destData.objects || [];
        const itemToAdd = removedItem || {
            id: item.id,
            keyword: item.keyword,
            type: item.type,
            name: item.name,
            description: item.description
        };
        destData.objects.push(itemToAdd);

        try {
            // Persiste localizações e nova coordenada do objeto no banco
            await WorldRepository.updateWorldObjectLocation(item.id, destLocation.x, destLocation.y);
            await saveLocationData(sourceLocation);
            await saveLocationData(destLocation);
            return true;
        } catch (err) {
            // Rollback em memória
            if (sourceData) {
                sourceData.objects = sourceData.objects || [];
                sourceData.objects.push(itemToAdd);
            }
            const index = destData.objects.findIndex(obj => String(obj.id) === String(item.id));
            if (index !== -1) {
                destData.objects.splice(index, 1);
            }
            throw err;
        }
    }

    /**
     * Transfere um item do chão para o inventário de um jogador.
     */
    static async transferItemToPlayer(item, sourceLocation, targetPlayer) {
        const sourceKey = `${sourceLocation.x},${sourceLocation.y}`;
        const sourceData = descriptions.get(sourceKey);

        // Remover da origem (memória)
        let removedItem = null;
        if (sourceData && sourceData.objects) {
            const index = sourceData.objects.findIndex(obj => String(obj.id) === String(item.id));
            if (index !== -1) {
                [removedItem] = sourceData.objects.splice(index, 1);
            }
        }

        const itemToAdd = removedItem || {
            id: item.id,
            keyword: item.keyword,
            type: item.type,
            name: item.name,
            description: item.description
        };

        // Adicionar ao inventário do jogador (memória)
        targetPlayer.inventory = targetPlayer.inventory || [];
        targetPlayer.inventory.push(itemToAdd);

        try {
            // Atualizar banco
            await WorldRepository.updateWorldObjectLocation(item.id, null, null);
            await saveLocationData(sourceLocation);
            await UserRepository.savePlayerLocation(targetPlayer.name, {
                x: targetPlayer.location?.x ?? 0,
                y: targetPlayer.location?.y ?? 0,
                inventory: targetPlayer.inventory
            });
            return true;
        } catch (err) {
            // Rollback em memória
            if (sourceData) {
                sourceData.objects = sourceData.objects || [];
                sourceData.objects.push(itemToAdd);
            }
            const pIndex = targetPlayer.inventory.findIndex(obj => String(obj.id) === String(item.id));
            if (pIndex !== -1) {
                targetPlayer.inventory.splice(pIndex, 1);
            }
            throw err;
        }
    }

    /**
     * Cria um novo objeto no mundo (seja coordenada ou inventário de jogador).
     */
    static async createObject({ keyword, type, name, description, x, y, targetPlayer }) {
        let created;
        if (targetPlayer) {
            // Criar no inventário do jogador
            created = await WorldRepository.createWorldObject({ keyword, type, name, description, x: null, y: null });
            targetPlayer.inventory = targetPlayer.inventory || [];
            targetPlayer.inventory.push({
                id: created.id,
                keyword: created.keyword,
                type: created.type,
                name: created.name,
                description: created.description
            });

            try {
                await UserRepository.savePlayerLocation(targetPlayer.name, {
                    x: targetPlayer.location?.x ?? 0,
                    y: targetPlayer.location?.y ?? 0,
                    inventory: targetPlayer.inventory
                });
            } catch (err) {
                // Rollback do inventário em memória
                targetPlayer.inventory.pop();
                await WorldRepository.deleteWorldObjectById(created.id);
                throw err;
            }
        } else {
            // Criar em coordenadas
            created = await WorldRepository.createWorldObject({ keyword, type, name, description, x, y });
            const key = `${x},${y}`;
            const locationData = descriptions.get(key) || {
                city: "Grade",
                place: "Local desconhecido",
                environment: "Área sem descrição",
                description: "Este local ainda não foi descrito.",
                objects: []
            };

            if (!descriptions.has(key)) {
                descriptions.set(key, locationData);
            }

            locationData.objects = locationData.objects || [];
            locationData.objects.push({
                id: created.id,
                keyword: created.keyword,
                type: created.type,
                name: created.name,
                description: created.description
            });

            try {
                await saveLocationData({ x, y });
            } catch (err) {
                // Rollback
                locationData.objects.pop();
                await WorldRepository.deleteWorldObjectById(created.id);
                throw err;
            }
        }
        return created;
    }

    /**
     * Destrói um objeto do mundo.
     */
    static async destroyObject(id) {
        const object = await WorldRepository.getWorldObjectById(id);
        if (!object) return null;

        const targetLocation = { x: object.x, y: object.y };
        
        // Remove da memória caso esteja no chão
        if (object.x !== null && object.y !== null) {
            const key = `${object.x},${object.y}`;
            const data = descriptions.get(key);
            if (data && data.objects) {
                const index = data.objects.findIndex(obj => String(obj.id) === String(id));
                if (index !== -1) {
                    data.objects.splice(index, 1);
                }
            }
        }

        try {
            await WorldRepository.deleteWorldObjectById(id);
            if (object.x !== null && object.y !== null) {
                await saveLocationData(targetLocation);
            }
            return object;
        } catch (err) {
            // Rollback em memória (se estava no chão)
            if (object.x !== null && object.y !== null) {
                const key = `${object.x},${object.y}`;
                const data = descriptions.get(key);
                if (data) {
                    data.objects = data.objects || [];
                    data.objects.push({
                        id: object.id,
                        keyword: object.keyword,
                        type: object.type,
                        name: object.name,
                        description: object.description
                    });
                }
            }
            throw err;
        }
    }

    /**
     * Solta um item do inventário do jogador no chão do local atual.
     */
    static async dropItem(player, item) {
        if (!player.location) {
            throw new Error("Posição do jogador desconhecida.");
        }

        const key = `${player.location.x},${player.location.y}`;
        const locationData = descriptions.get(key);
        if (!locationData) {
            throw new Error("Local desconhecido na memória.");
        }

        // Remover de memória do jogador
        const index = player.inventory.findIndex(obj => String(obj.id) === String(item.id));
        if (index === -1) {
            throw new Error("Item não está no inventário.");
        }
        player.inventory.splice(index, 1);

        // Adicionar à memória do local
        locationData.objects = locationData.objects || [];
        locationData.objects.push(item);

        try {
            // Atualizar banco
            await WorldRepository.updateWorldObjectLocation(item.id, player.location.x, player.location.y);
            await UserRepository.savePlayerLocation(player.name, {
                x: player.location.x,
                y: player.location.y,
                inventory: player.inventory
            });
            await saveLocationData(player.location);
            return true;
        } catch (err) {
            // Rollback em memória
            locationData.objects.pop();
            player.inventory.push(item);
            throw err;
        }
    }
}
