import React from "react";
import { getFriendshipScale } from "../../core/experience.js";
import { integerInRange } from "../../core/math.js";

export default function FriendshipValue({ friendship, isTTRPG = true }) {
    const raw = integerInRange(friendship, 0, 255, 70);
    const value = isTTRPG ? getFriendshipScale(raw) : raw;
    const max = isTTRPG ? 25 : 255;
    return <span className="friendship-reading">
        <span><strong>{value}</strong> de {max}</span>
        <span className="friendship-meter" role="meter" aria-label={isTTRPG ? "Amizade no RPG" : "Amizade nos jogos"} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
            <span style={{ width: `${value / max * 100}%` }} />
        </span>
    </span>;
}
