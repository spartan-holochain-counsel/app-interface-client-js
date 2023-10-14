
export function ORMProxy ( target = {}, create_fn ) {
    return new Proxy( target, {
	set ( target, cell_name, cell_spec, ...args ) {
	    throw new Error(`ORM values cannot be set`);
	},
	get ( target, key, ...args ) {
	    if ( target[ key ] === undefined )
		Reflect.set( target, key, create_fn( key ), ...args );

	    return Reflect.get( target, key, ...args );
	},
    });
}


export function CellsProxy ( target = {}, context ) {
    return new Proxy( target, {
	set ( target, cell_name, cell_spec, ...args ) {

	    if ( cell_spec?.constructor?.name !== "ScopedCellZomelets" )
		throw new TypeError(`Cannot set '${cell_name}' to value '${cell_spec}'; Expected an instance with a constructor named 'ScopedCellZomelet'`);

	    return Reflect.set( target, cell_name, cell_spec, ...args );
	},
	get ( target, cell_name, ...args ) {
	    const value			= Reflect.get( target, cell_name, ...args );

	    if ( value === undefined )
		throw new Error(`Cell '${cell_name}' does not exist in ${context}`);

	    return value;
	},
    });
}


export function ZomesProxy ( target = {}, context ) {
    return new Proxy( target, {
	set ( target, zome_name, zome_spec, ...args ) {

	    if ( zome_spec?.constructor?.name !== "ScopedZomelet" )
		throw new TypeError(`Cannot set '${zome_name}' to value '${zome_spec}'; Expected an instance with a constructor named 'ScopedZomelet'`);

	    return Reflect.set( target, zome_name, zome_spec, ...args );
	},
	get ( target, zome_name, ...args ) {
	    const value			= Reflect.get( target, zome_name, ...args );

	    if ( value === undefined )
		throw new Error(`Zome '${zome_name}' does not exist in ${context}`);

	    return value;
	},
    });
}


export function FunctionsProxy ( target = {}, context ) {
    return new Proxy( target, {
	set ( target, function_name, handler, ...args ) {

	    if ( typeof handler !== "function" )
		throw new TypeError(`Cannot set '${function_name}' to type '${typeof handler}'; Expected a 'function'`);

	    return Reflect.set( target, function_name, handler, ...args );
	},
	get ( target, function_name, ...args ) {
	    const value			= Reflect.get( target, function_name, ...args );

	    if ( value === undefined )
		throw new Error(`'${function_name}' does not have a defined function in ${context}`);

	    return value;
	},
    });
}


export function PeerCellsProxy ( target = {}, calling_zome_name ) {
    return new Proxy( target, {
	set ( target, role_name, funcs, ...args ) {
	    throw new Error(`You do not need to set values; 'get' will create a functions object for you`);
	},
	get ( target, role_name, ...args ) {
	    if ( target[ role_name ] === undefined )
		Reflect.set( target, role_name, new PeerZomesProxy( {}, calling_zome_name ), ...args );

	    return Reflect.get( target, role_name, ...args );
	},
    });
}


export function PeerZomesProxy ( target = {}, calling_zome_name ) {
    return new Proxy( target, {
	set ( target, zome_name, funcs, ...args ) {
	    throw new Error(`You do not need to set values; 'get' will create a functions object for you`);
	},
	get ( target, zome_name, ...args ) {
	    if ( target[ zome_name ] === undefined )
		Reflect.set( target, zome_name, new PeerFunctionsProxy( {}, calling_zome_name ), ...args );

	    return Reflect.get( target, zome_name, ...args );
	},
    });
}


export function PeerFunctionsProxy ( target = {}, calling_zome_name ) {
    return new Proxy( target, {
	set ( target, name, func, ...args ) {

	    if ( typeof func !== "function" )
		throw new TypeError(`Cannot set '${name}' to value '${func}'; Expected value to be a 'function'`);

	    return Reflect.set( target, name, func, ...args );
	},
	get ( target, name, ...args ) {
	    const value			= Reflect.get( target, name, ...args );

	    if ( value === undefined )
		throw new Error(`Function '${name}' is not defined in Zomelet '${calling_zome_name}'`);

	    return value;
	},
    });
}


export default {
    ORMProxy,
    CellsProxy,
    ZomesProxy,
    FunctionsProxy,
    PeerCellsProxy,
    PeerZomesProxy,
    PeerFunctionsProxy,
};
