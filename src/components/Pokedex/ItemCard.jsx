import React from 'react';
import TraitReference from './TraitReference.jsx';

export default function ItemCard(props) {
    return <TraitReference {...props} kind="item" />;
}
