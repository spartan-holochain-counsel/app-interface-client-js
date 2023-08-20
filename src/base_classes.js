
import { heritage }			from './utils.js';


export function replacer( key, value ) {
    if ( value instanceof Map ) {
	return [...value].reduce( (acc, [ key, value ]) => {
	    acc[ String(key) ]	= value;
	    return acc;
	}, {} );
    }
    else if ( value instanceof Uint8Array ) {
	// Avoid long vertical dumps
	return {
	    "dataType": "Uint8Array",
	    "bytes": (new BaseUint8Array( value )).toJSON( key ),
	};
    }
    // For some reason, a natural 'Object' wrapped in a Proxy returns 'toJSON' as one of its keys.
    //
    // However, I can't find any explanations for this behavior online.
    else if ( key === "toJSON" ) {
	return;
    } else {
	return value;
    }
}


export class Base {
    toJSON ( key ) {
	return Object.assign({}, this);
    }

    toString () {
	let classes		= heritage( this, "Base" );
	return `${classes.join("::")} ${JSON.stringify( this, replacer, 4 )}`;
    }

    heritage () {
	let classes		= heritage( this, "Base" );
	return classes.join("::");
    }
}

export class BaseArray extends Array {
    first () {
	return this[0];
    }

    last () {
	return this[ this.length-1 ];
    }

    get ( index ) {
	return this[ index ] === undefined
	    ? null
	    : this[ index ];
    }

    toJSON ( key ) {
	return [...this];
    }

    toString () {
	let classes		= heritage( this, "BaseArray" );
	return `${classes.join("::")} ${JSON.stringify( this.toJSON(), replacer, 4 )}`.trim();
    }

    heritage () {
	let classes		= heritage( this, "Base" );
	return classes.join("::");
    }
}

export class BaseUint8Array extends Uint8Array {
    toJSON ( key, max_length ) {
	return this.toString( false, false, max_length );
    }

    toString ( multiline = true, show_context = true, max_length = 50 ) {
	let classes		= heritage( this, "BaseUint8Array" );
	const class_str		= classes.join("::");

	let bytes		= (new Uint8Array( this )).subarray(0, max_length);
	const hex_lines		= [];

	let index		= 0;
	while ( index < bytes.length ) {
	    const chunk		= bytes.subarray(index, index+16);
	    const chunk_str	= [].map.call( chunk, x => x.toString(16).padStart(2, "0") ).join(" ");
	    hex_lines.push( chunk_str );
	    index	       += 16;
	}

	if ( bytes.length < this.length ) // was truncated
	    hex_lines.push(`... ${this.length - max_length} more bytes`);

	const delimiter		= multiline ? "\n    " : " ";
	const hex_str		= hex_lines.join( delimiter );
	const repr		= multiline ? " \n    " + hex_str + "\n" : hex_str;

	return show_context ? `${class_str} {${repr}}` : repr;
    }

    heritage () {
	let classes		= heritage( this, "Base" );
	return classes.join("::");
    }
}


export class BaseSet extends Set {
    differences(otherSet) {
	const removed		= [];
	const added		= [];
	const intersection	= [];

	for (const element of this) {
	    if (!otherSet.has(element)) {
		removed.push(element);
	    } else {
		intersection.push(element);
	    }
	}

	for (const element of otherSet) {
	    if (!this.has(element)) {
		added.push(element);
	    }
	}

	return {
	    removed,
	    added,
	    intersection,
	};
    }
}


export default {
    replacer,
    Base,
    BaseArray,
    BaseUint8Array,
    BaseSet,
};
