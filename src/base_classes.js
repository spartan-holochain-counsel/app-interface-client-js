import { Logger }			from '@whi/weblogger';
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
    static defaults		= {
	"logging": "fatal",
    };
    #set_options		= {};
    #options			= {};
    #logger			= null;

    constructor ( ...options ) {
	Object.assign( this.#set_options, ...options );
	Object.assign( this.#options, Base.defaults, this.constructor.defaults, ...options );

	this.#logger		= new Logger( this.constructor.name, this.options.logging );
    }

    get set_options () {
	return Object.assign({}, this.#set_options );
    }

    get options () {
	return Object.assign({}, this.#options );
    }

    get log () {
	return this.#logger;
    }

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


export default {
    replacer,
    Base,
};
