import {ExplicitContainer} from '../Interface/ExplicitContainer';
import {Player, PlayerManager} from '../Manager/PlayerManager';
import {UnitTypeManager} from '../Manager/UnitTypeManager';
import {GameMap} from './GameMap';
import {HexagonField} from './HexagonField';
import {HexagonGrid} from './HexagonGrid';
import {PanelProps} from './Overlay/Panel';
import {Territory} from './Territory';
import {Unit, UnitType} from './Unit';
import Container = PIXI.Container;
import InteractionEvent = PIXI.interaction.InteractionEvent;

export interface GameProps {
    playerManager: PlayerManager;
    grid: HexagonGrid;
    updatePanel: (props: GamePanelProps) => void;
    unitTypeManager: UnitTypeManager;
    dragManager: GameDragManager;
    onWin: (player: Player) => void;
}

export interface GameDragManager {
    getDragging: () => Unit | undefined;
    setDragging: (unit?: Unit) => void;
}

export type GamePanelProps = Pick<PanelProps, 'player' | 'territory'>;

export class Game extends Container {
    private props: GameProps;
    private map: GameMap;
    private player: Player;
    private unitContainer: ExplicitContainer<Unit>;
    private turn: number;

    constructor(props: GameProps) {
        super();
        this.props = props;
        this.player = this.props.playerManager.first();
        this.map = new GameMap({grid: this.props.grid});
        this.turn = 1;
        this.unitContainer = new Container() as ExplicitContainer<Unit>;

        this.addChild(this.props.grid);
        this.addChild(this.unitContainer);

        for (const field of this.props.grid.fields()) {
            field.interactive = true;
            field.on('click', (e) => {
                const {dragManager} = this.props;
                const unit = dragManager.getDragging();
                console.log('click field');
                if (unit !== undefined) {
                    const originalField = unit.props.field;
                    const success = this.moveUnit(unit, field);
                    // Reset unit dragging
                    dragManager.setDragging(undefined);
                    if (!success) {
                        // Reset unit position
                        if (originalField) {
                            unit.position = originalField.position;
                        } else {
                            console.warn('Newly bought unit cant move there');
                            // todo: refactor, it gets added to the unitContainer from the dragging setter
                            // Refund unit payment
                            if (this.player.selectedTerritory) {
                                this.player.selectedTerritory.money += unit.props.type.cost;
                            }
                            this.unitContainer.removeChild(unit);
                        }
                    }
                } else if (field.territory && field.player === this.player) {
                    // Only select other territory if no unit is dragging and its the current player
                    this.selectTerritory(field.territory);
                } else {
                    console.warn('Can\'t use another players territory');
                }
            });
        }
        for (const territory of this.map.territories) {
            const size = territory.props.fields.length;
            if (size > 1) {
                const field = territory.props.fields[0];
                this.addNewUnitToField(this.props.unitTypeManager.mainBuilding, field);
            }
        }
        this.handleTurnStart();
    }

    private updatePanel() {
        this.props.updatePanel({
            player: this.player,
            territory: this.player.selectedTerritory,
        });
    }

    private addNewUnitToField(type: UnitType, field: HexagonField) {
        const unit = new Unit({
            type: type,
            field: field,
            onClick: this.handleUnitClick,
        });
        this.setUnitToField(unit, field);
        this.unitContainer.addChild(unit);
    }

    private setUnitToField(unit: Unit, field: HexagonField) {
        // Remove unit from previous field
        if (unit.props.field) {
            unit.props.field.unit = undefined;
        } else {
            // Unit has no field, so it must be newly bought
            this.unitContainer.addChild(unit);
        }
        // Add field to unit
        unit.props.field = field;
        // Set unit to new field
        field.unit = unit;
        // Reset unit position
        unit.position = field.position;
    }

    private selectTerritory(territory: Territory) {
        this.unselectTerritory();
        this.player.selectedTerritory = territory;
        this.updatePanel();
        this.tintTerritory(this.player.selectedTerritory, 0x555555);
    }

    private unselectTerritory() {
        if (this.player.selectedTerritory) {
            this.tintTerritory(this.player.selectedTerritory, 0xffffff);
            this.player.selectedTerritory = undefined;
        }
    }

    public handleTurnStart = () => {
        const {unitTypeManager, playerManager} = this.props;
        const isFirstTurn = this.turn / playerManager.players.length <= 1;
        // Attach unit click handlers for current player and remove others
        this.setCurrentPlayerInteractivity();
        // Territories on turn
        for (const territory of this.map.territories) {
            if (territory.props.player === this.player) {
                if (isFirstTurn) {
                    territory.onStart();
                } else {
                    territory.onTurn();
                }
                // Remove units if territory is bankrupt
                if (territory.isBankrupt()) {
                    console.log('Territory bankruptcy');
                    for (const field of territory.props.fields) {
                        if (field.unit !== undefined && field.unit.props.type !== unitTypeManager.mainBuilding) {
                            this.removeUnit(field.unit);
                        }
                    }
                    territory.money = 0;
                }
            }
        }
        // Set current player to panel
        this.updatePanel();
    };
    public handleTurnEnd = () => {
        const {onWin} = this.props;
        this.unselectTerritory();
        const {playerFieldCount, fieldCount} = this.playerFieldCount(this.player);
        if (playerFieldCount * 100 / fieldCount > 60) {
            // todo: check if player has won directly after turn
            // todo: win condition based on player count
            onWin(this.player);
            return;
        }
    };

    public nextTurn = () => {
        const {playerManager} = this.props;
        this.handleTurnEnd();
        // Check if next player has already lost and remove him if so
        let nextPlayer;
        let i = playerManager.players.length;
        do {
            nextPlayer = playerManager.next(this.player);
            const {playerFieldCount} = this.playerFieldCount(this.player);
            if (playerFieldCount === 0) {
                // todo: lost based on controllable territories
                playerManager.remove(nextPlayer);
                nextPlayer = undefined;
            }
        } while (nextPlayer === undefined && i-- > 0);
        if (nextPlayer === undefined) {
            console.error('Next turn next player chooser is probably broken');
            return;
        }
        this.player = nextPlayer;
        // Start next turn
        this.turn++;
        this.handleTurnStart();
    };

    private playerFieldCount(player: Player): { playerFieldCount: number, fieldCount: number } {
        let fieldCount = 0;
        let playerFieldCount = 0;
        for (const field of this.props.grid.fields()) {
            fieldCount++;
            if (field.player === player) {
                playerFieldCount++;
            }
        }
        return {playerFieldCount, fieldCount};
    }

    private setCurrentPlayerInteractivity(): void {
        for (const unit of this.unitContainer.children) {
            const field = unit.props.field;
            if (field && field.player === this.player) {
                unit.onTurn();
            } else {
                unit.offTurn();
            }
        }
    }

    private moveUnit = (unit: Unit, field: HexagonField): boolean => {
        if (unit === field.unit) {
            console.warn('Unit is already on this field');
            return false;
        }
        // Use unit field territory and player
        let territory: Territory;
        if (unit.props.field && unit.props.field.territory) {
            territory = unit.props.field.territory;
        } else if (this.player.selectedTerritory !== undefined) {
            // Use selected territory if new unit bought and doesn't have a field attached yet
            territory = this.player.selectedTerritory;
        } else {
            console.warn('No territory selected');
            return false;
        }
        const fieldTerritory = field.territory;
        if (fieldTerritory === undefined) {
            console.warn('Field has no territory');
            return false;
        }
        const territoryNeighbors = this.map.getTerritoryNeighbors(territory);
        const isMovingToNeighbors = territoryNeighbors.includes(field);
        const isMovingInsideTerritory = territory.props.fields.includes(field);
        if (isMovingInsideTerritory) {
            console.log('is moving inside territory');
        } else if (!unit.canMove) {
            console.warn('Only movable units can be placed outside the territory');
            return false;
        }
        if (!isMovingToNeighbors && !isMovingInsideTerritory) {
            console.warn('Unit can only move to neighbors or inside same territory');
            return false;
        }
        // capture field
        if (field.player !== this.player) {
            const fieldNeighbors = this.props.grid.getFieldNeighbors(field);
            const defendingPoints = Math.max(...fieldNeighbors.map((f) => {
                return (f.player !== field.player ? 0 : (f.unit ? f.unit.props.type.strength : 0));
            }));
            const attacking = unit.props.type;
            if (attacking.strength <= defendingPoints) {
                console.warn('Field is defended by a stronger or same strength unit');
                return false;
            }
            // Attack unit if there is one on this field
            if (field.unit !== undefined) {
                const defending = field.unit.props.type;
                if (attacking.strength <= defending.strength) {
                    console.warn('Unit can only attack weaker units');
                    return false;
                }
                // Defending is main building
                if (defending === this.props.unitTypeManager.mainBuilding) {
                    fieldTerritory.money = 0;
                }
                // Remove defending unit
                this.unitContainer.removeChild(field.unit);
                field.unit.props.field = undefined;
                field.unit = undefined;
                console.log('Defending unit killed');
            }
            field.player = this.player;
            // Remove from old territory
            fieldTerritory.props.fields.splice(fieldTerritory.props.fields.indexOf(field), 1);
            // Add to new territory
            territory.props.fields.push(field);
            // Set new territory to field
            field.territory = territory;
            // Merge territories
            const notConnectedTerritories = new Set<Territory>(fieldNeighbors.filter((neighbor) => {
                return neighbor.player === this.player && neighbor.territory !== territory;
            }).map((neighbor) => {
                return neighbor.territory as Territory;
            }));
            for (const neighbor of notConnectedTerritories) {
                territory.money += neighbor.money;
                // Remove other main buildings
                this.removeUnit(this.getTerritoryMainBuilding(neighbor));
                // Add fields to territory and remove other territory
                territory.addField(...neighbor.props.fields);
                neighbor.props.fields = [];
                this.map.territories.splice(this.map.territories.indexOf(neighbor), 1);
            }
            // Split
            const enemyFields = fieldNeighbors.filter((neighbor) => {
                return neighbor.player !== this.player;
            });
            const fieldsChecked: HexagonField[] = [];
            for (const enemyField of enemyFields) {
                if (fieldsChecked.includes(enemyField)) {
                    continue;
                }
                fieldsChecked.push(enemyField);
                const onSameTerritory = enemyFields.filter((item) => {
                    return item.territory === enemyField.territory && item !== enemyField;
                });
                if (onSameTerritory.length > 0) {
                    // Loop trough fields with the same territory
                    for (const fieldOnSameTerritory of onSameTerritory) {
                        if (fieldsChecked.includes(fieldOnSameTerritory)) {
                            continue;
                        }
                        fieldsChecked.push(fieldOnSameTerritory);
                        // If the connected fields don't contain each other they are split up
                        const connectedFields = this.props.grid.getConnectedFields(fieldOnSameTerritory);
                        if (!connectedFields.has(enemyField)) {
                            // make new territory
                            const newTerritory = new Territory({
                                player: fieldOnSameTerritory.player,
                                fields: [],
                            });
                            // Remove fields from old territory
                            for (const connectedField of connectedFields) {
                                if (connectedField.territory) {
                                    const index = connectedField.territory.props.fields.indexOf(connectedField);
                                    connectedField.territory.props.fields.splice(index, 1);
                                }
                            }
                            // Add to new territory
                            newTerritory.addField(...connectedFields);
                            this.map.territories.push(newTerritory);
                        }
                    }
                }
            }
            // Renew main buildings
            const enemyTerritories = new Set(enemyFields.map((neighbor) => {
                return neighbor.territory as Territory;
            }));
            for (const enemyTerritory of enemyTerritories) {
                const mainBuilding = this.getTerritoryMainBuilding(enemyTerritory);
                // add new main building if there is none and territory is controllable
                if (mainBuilding === undefined && enemyTerritory.isControllable()) {
                    const mainBuildingField = enemyTerritory.props.fields.find((item) => {
                        return item.unit !== undefined
                            && item.unit.props.type === this.props.unitTypeManager.mainBuilding;
                    });
                    if (mainBuildingField === undefined) {
                        // Add building to the field without a unit or replace it with the weakest one
                        function fieldScore(field: HexagonField) {
                            return field.unit === undefined ? 0 : field.unit.props.type.strength;
                        }

                        const fields = enemyTerritory.props.fields.sort((a, b) => {
                            return fieldScore(a) - fieldScore(b);
                        });
                        const newMainBuildingField = fields[0];
                        if (newMainBuildingField) {
                            this.addNewUnitToField(this.props.unitTypeManager.mainBuilding, newMainBuildingField);
                        }
                    }
                } else if (mainBuilding !== undefined && !enemyTerritory.isControllable()) {
                    // Remove main building if there is one and territory isn't controllable anymore
                    this.removeUnit(this.getTerritoryMainBuilding(enemyTerritory));
                }
            }
            // Recalculate selected territory
            if (this.player.selectedTerritory) {
                this.selectTerritory(this.player.selectedTerritory);
            }
        } else if (field.unit !== undefined) {
            // Merge units from the same player if there is a unit with the same cost
            const droppedType = field.unit.props.type;
            const stayingType = unit.props.type;
            const cost = stayingType.cost + droppedType.cost;
            const mergedType = this.props.unitTypeManager.units.find((type) => {
                return type.cost === cost;
            });
            if (mergedType) {
                console.log('Units merged', {
                    dropped: stayingType,
                    staying: droppedType,
                    merged: mergedType,
                });
                // If unit staying has already moved the merged one has too
                unit.canMove = field.unit.canMove;
                this.removeUnit(field.unit);
                unit.setType(mergedType);
            } else {
                console.warn('No type with same cost found to merge');
                return false;
            }
        }
        this.setUnitToField(unit, field);
        // Disable moving on moved unit for this turn if it has moved to neighbors
        if (isMovingToNeighbors) {
            console.log('has moved to neighbors, disable moving this turn');
            unit.canMove = false;
        }
        return true;
    };

    private removeUnit(unit: Unit | undefined) {
        if (unit && unit.props.field) {
            unit.props.field.unit = undefined;
            unit.props.field = undefined;
            this.unitContainer.removeChild(unit);
        }
    }

    private getTerritoryMainBuilding(territory: Territory): Unit | undefined {
        const field = territory.props.fields.find((item) => {
            return item.unit !== undefined && item.unit.props.type === this.props.unitTypeManager.mainBuilding;
        });
        if (field === undefined) {
            return undefined;
        }
        return field.unit;
    }

    private handleUnitClick = (unit: Unit, e: InteractionEvent) => {
        console.log('click unit');
        const {dragManager} = this.props;
        if (dragManager.getDragging() === undefined) {
            dragManager.setDragging(unit);
            e.stopPropagation();
        }
    };

    public handlePanelUnitClick = (type: UnitType, position: { x: number, y: number }) => {
        console.log('panel unit click', type);
        const territory = this.player.selectedTerritory;
        if (territory === undefined) {
            console.warn('no territory selected');
            return;
        }
        const {dragManager} = this.props;
        if (dragManager.getDragging() !== undefined) {
            console.warn('you can\'t drag another unit');
            return;
        }
        if (territory.money < type.cost) {
            console.warn('not enough money to buy this unit');
            return;
        }
        territory.money -= type.cost;
        const unit = new Unit({type, onClick: this.handleUnitClick});
        unit.x = position.x;
        unit.y = position.y;
        dragManager.setDragging(unit);
    };

    private tintTerritory(territory: Territory | undefined, tint: number) {
        if (territory) {
            for (const field of territory.props.fields) {
                field.tint = tint;
            }
        }
    }
}
