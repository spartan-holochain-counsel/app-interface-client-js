
import { decode }			from '@msgpack/msgpack';
import {
    DnaHash,
    AgentPubKey,
}					from '@spartan-hc/holo-hash';


export function heritage ( target, stop_at = "" ) {
    if ( typeof target !== "function" ) {
	// Empty heritage for primitive types
	if ( target === null || typeof target !== "object" )
	    return [];
	else
	    target			= target.constructor;
    }

    let i				= 0;
    let class_names			= [];
    while ( target.name !== stop_at ) {
	class_names.unshift( target.name );
	target				= Object.getPrototypeOf( target );
	i++;

	if ( i > 50 )
	    throw new Error(`heritage exceeded recursive limit (50); ${class_names.join(", ")}`);
    }

    return class_names;
}

export function set_tostringtag ( cls, name ) {
    Object.defineProperty( cls, "name", {
	value: name || cls.name,
    });
    Object.defineProperty( cls.prototype, Symbol.toStringTag, {
	value: name || cls.name,
	enumerable: false,
    });
}

export function reformat_cell_id ( cell_id ) {
    return [
	new DnaHash(	 cell_id[0] ),
	new AgentPubKey( cell_id[1] ),
    ];
}

export async function reformat_app_info ( app_info ) {
    // {
    //     installed_app_id: 'test-alice',
    //     cell_info: { storage: [ [Object] ] },
    //     status: { running: null },
    //     agent_pub_key: Uint8Array(39) [
    //         132,  32,  36, 231,  86,  88, 237, 207,  77,
    //         37, 136,  27,  14,  52,  20, 134, 197,  46,
    //         239, 162, 166, 213, 176, 112,  67,  44, 178,
    //         6, 164,  13, 102, 193,  24, 108, 122, 152,
    //         95, 205,  67
    //     ],
    //     manifest: {
    //         manifest_version: '1',
    //         name: 'Storage',
    //         description: 'Simple byte storage',
    //         roles: [ [Object] ]
    //     }
    // }

    // app_info.cell_info		- Map of role name to cell list
    // app_info.cell_info[ role name ]	- 1 Provisioned cell, followed by cloned or stem cells

    app_info.roles			= {};

    for ( let [role_name, cells] of Object.entries( app_info.cell_info ) ) {
	// The first cell info is the original provisioned one.  The rest are clones.
	const role			= app_info.roles[ role_name ] = {
	    "cloned": [],
	};

	const base_cell			= cells.shift();

	if ( base_cell.provisioned ) {
	    role.provisioned		= true;
	    Object.assign( role, base_cell.provisioned );
	    role.cell_id		= reformat_cell_id( role.cell_id );
	}
	else if ( base_cell.stem ) {
	    role.provisioned		= false;
	    Object.assign( role, base_cell.stem );
	}

	delete role.clone_id;

	// `dna_modifiers` is always there whether it's provisioned or stem
	role.dna_modifiers.properties	= decode( role.dna_modifiers.properties );

	for ( let cell of cells ) {
	    if ( cell.cloned ) {
		cell			= cell.cloned;
		cell.cell_id		= reformat_cell_id( cell.cell_id );
		role.cloned.push( cell );
	    }
	    else
		throw new TypeError(`Unknown cell info format: ${Object.keys(cell)}`);
	}
    }

    delete app_info.cell_info;

    app_info.running			= app_info.status.running !== undefined;

    return app_info;
}

export function is_type ( target, type ) {
    if ( typeof target !== "object" )
	return typeof target === type;

    if ( target === null )
	return type === "null";

    return target?.constructor?.name === type;
}

export function assert ( target, type, err_msg ) {
    if ( is_type( target, type ) === false )
	throw new TypeError( err_msg || `Target '${target}' did not match type '${type}'` );
}

function nonce () {
    return crypto.getRandomValues( new Uint8Array(32) );
}


export default {
    heritage,
    set_tostringtag,
    reformat_cell_id,
    reformat_app_info,
    is_type,
    assert,
    nonce,
};
