import * as React from 'react';
import {colorToString} from '../../../Function/Color';
import {PlayerManager} from '../../../Manager/PlayerManager';

export interface PlayerStatisticsProps {
    playerManager: PlayerManager;
}

export class PlayerStatistics extends React.Component<PlayerStatisticsProps> {
    render() {
        const {playerManager} = this.props;
        const players = playerManager.players.map((player) => {
            const fieldCount = player.territories.map(
                (territory) => territory.props.fields,
            ).reduce((previous, current) => {
                return Array().concat(previous, current);
            }).length;
            return {...player, fieldCount};
        });
        const maxFieldCount = Math.max(...players.map((player) => player.fieldCount));
        return <div className="row" style={{height: '4rem', alignItems: 'flex-end'}}>
            {players.map((player) => {
                const height = player.fieldCount / maxFieldCount * 100;
                return (
                    <div key={player.id} className="col" style={{
                        background: colorToString(player.color),
                        height: `${height}%`,
                    }}/>
                );
            })}
        </div>;
    }
}
