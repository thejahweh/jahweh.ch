import {Graphics, Point, RenderTexture} from 'pixi.js';
import {UnitType} from '../Component/Unit';

interface Props {
    textureGenerator: (graphics: Graphics) => RenderTexture;
}

interface UnitTypeDefinition extends Pick<UnitType, Exclude<keyof UnitType, 'texture'>> {
    texture: 'circle' | 'square' | 'line' | 'line-2' | 'line-3' | 'line-4';
}

const mainBuildingDefinition: UnitTypeDefinition = {
    name: 'Gym',
    strength: 1,
    cost: 0,
    salary: 0,
    isBuildable: false,
    isMovable: false,
    texture: 'circle',
};

const unitTypeDefinitions: UnitTypeDefinition[] = [
    mainBuildingDefinition,
    {
        name: 'Instructor',
        strength: 2,
        cost: 14,
        salary: 0,
        isBuildable: true,
        isMovable: false,
        texture: 'square',
    }, {
        name: 'Leek',
        strength: 1,
        cost: 8,
        salary: 2,
        isBuildable: true,
        isMovable: true,
        texture: 'line',
    }, {
        name: 'Gym Bro',
        strength: 2,
        cost: 16,
        salary: 5,
        isBuildable: true,
        isMovable: true,
        texture: 'line-2',
    }, {
        name: 'Bodybuilder',
        strength: 3,
        cost: 24,
        salary: 15,
        isBuildable: true,
        isMovable: true,
        texture: 'line-3',
    }, {
        name: 'Strongman',
        strength: 4,
        cost: 32,
        salary: 45,
        isBuildable: true,
        isMovable: true,
        texture: 'line-4',
    },
];

export class UnitTypeManager {
    private props: Props;
    public readonly units: UnitType[];
    public readonly mainBuilding: UnitType;

    constructor(props: Props) {
        this.props = props;
        this.mainBuilding = this.definitionToUnitType(mainBuildingDefinition);
        this.units = [];
        for (const definition of unitTypeDefinitions) {
            this.units.push(this.definitionToUnitType(definition));
        }
    }

    private definitionToUnitType(definition: UnitTypeDefinition): UnitType {
        return {...definition, texture: this.definitionToTexture(definition.texture)};
    }

    private definitionToTexture(definition: string): RenderTexture {
        const graphics = new Graphics();
        graphics.lineStyle(1, 0x222222);
        graphics.beginFill(0x6789AB);
        switch (definition) {
            case 'square':
                graphics.drawRect(0, 0, 15, 15);
                break;
            case 'line':
                graphics.drawRect(0, 0, 4, 20);
                break;
            case 'line-2':
                graphics.drawRect(0, 0, 6, 20);
                break;
            case 'line-3':
                graphics.drawRect(0, 0, 8, 20);
                break;
            case 'line-4':
                graphics.drawRect(0, 0, 10, 20);
                break;
            case 'circle':
            default:
                graphics.drawCircle(0, 0, 10);
        }
        graphics.endFill();
        const texture = this.props.textureGenerator(graphics);
        texture.defaultAnchor = new Point(0.5, 0.5);
        return texture;
    }
}
