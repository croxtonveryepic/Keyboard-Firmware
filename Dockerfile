FROM docker.io/zmkfirmware/zmk-build-arm:stable

WORKDIR /app

ARG ZMK_MANIFEST=config/west.yml
COPY ${ZMK_MANIFEST} config/west.yml

# West Init
RUN west init -l config
# West Update
RUN west update
# West Zephyr export
RUN west zephyr-export

COPY bin/build.sh ./

CMD ["./build.sh"]
