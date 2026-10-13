DOCKER := $(shell { command -v podman || command -v docker; })

.PHONY: all left glove80 glove80-left keyboards clean_firmware clean_image clean

all:
	bash bin/local_build.sh adv360

left:
	bash bin/local_build.sh adv360 left

glove80:
	bash bin/local_build.sh glove80

glove80-left:
	bash bin/local_build.sh glove80 left

keyboards:
	bash bin/local_build.sh adv360
	bash bin/local_build.sh glove80

clean_firmware:
	rm -f firmware/*.uf2

clean_image:
	$(DOCKER) image rm zmk zmk-glove80 docker.io/zmkfirmware/zmk-build-arm:stable

clean: clean_firmware clean_image
