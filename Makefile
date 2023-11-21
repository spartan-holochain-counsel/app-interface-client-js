.PHONY:			FORCE

#
# Project
#
package-lock.json:	package.json
	npm install
	touch $@
node_modules:		package-lock.json
	npm install
	touch $@
build:			node_modules

npm-reinstall-local:
	cd tests; npm uninstall $(NPM_PACKAGE); npm i --save $(LOCAL_PATH)
npm-reinstall-public:
	cd tests; npm uninstall $(NPM_PACKAGE); npm i --save $(NPM_PACKAGE)

npm-use-holo-host-public:
npm-use-holo-host-local:
npm-use-holo-host-%:
	NPM_PACKAGE=@spartan-hc/holo-host LOCAL_PATH=../../holo-host-js make npm-reinstall-$*

npm-use-serialization-public:
npm-use-serialization-local:
npm-use-serialization-%:
	NPM_PACKAGE=@spartan-hc/holochain-serialization LOCAL_PATH=../../holochain-serialization-js make npm-reinstall-$*

npm-use-websocket-public:
npm-use-websocket-local:
npm-use-websocket-%:
	NPM_PACKAGE=@spartan-hc/holochain-websocket LOCAL_PATH=../../holochain-websocket-js make npm-reinstall-$*

npm-use-admin-client-public:
npm-use-admin-client-local:
npm-use-admin-client-%:
	NPM_PACKAGE=@spartan-hc/holochain-admin-client LOCAL_PATH=../../holochain-admin-client-js make npm-reinstall-$*

npm-use-backdrop-public:
npm-use-backdrop-local:
npm-use-backdrop-%:
	NPM_PACKAGE=@spartan-hc/holochain-backdrop LOCAL_PATH=../../node-holochain-backdrop make npm-reinstall-$*

npm-use-zomelets-public:
npm-use-zomelets-local:
npm-use-zomelets-%:
	NPM_PACKAGE=@spartan-hc/zomelets LOCAL_PATH=../../zomelets-js make npm-reinstall-$*


MOCHA_OPTS		= -t 15000
#
# Testing
#
CONTENT_DNA			= tests/content_dna.dna
TEST_DNAS			= $(CONTENT_DNA)

tests/%.dna:			FORCE
	cd tests; make $*.dna
test:				test-unit	test-integration
test-debug:			test-unit-debug	test-integration-debug

test-unit:		build
	LOG_LEVEL=fatal npx mocha $(MOCHA_OPTS) ./tests/unit
test-unit-debug:	build
	LOG_LEVEL=trace npx mocha $(MOCHA_OPTS) ./tests/unit

test-integration:		build $(CONTENT_DNA)
	LOG_LEVEL=fatal npx mocha $(MOCHA_OPTS) ./tests/integration
test-integration-debug:		build $(CONTENT_DNA)
	LOG_LEVEL=trace npx mocha $(MOCHA_OPTS) ./tests/integration



#
# Repository
#
clean-remove-chaff:
	@find . -name '*~' -exec rm {} \;
clean-files:		clean-remove-chaff
	git clean -nd
clean-files-force:	clean-remove-chaff
	git clean -fd
clean-files-all:	clean-remove-chaff
	git clean -ndx
clean-files-all-force:	clean-remove-chaff
	git clean -fdx



#
# NPM packaging
#
prepare-package:
	rm -f dist/*
	npx webpack
	MODE=production npx webpack
	gzip -kf dist/*.js
preview-package:	clean-files test prepare-package
	npm pack --dry-run .
create-package:		clean-files test prepare-package
	npm pack .
publish-package:	clean-files test prepare-package
	npm publish --access public .
