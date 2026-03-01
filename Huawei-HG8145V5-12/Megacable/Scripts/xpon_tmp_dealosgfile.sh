in/sh

#set hw parameters
#copy etc/wap/hw_default_ctree.xml to /mnt/jffs2/hw_ctree.xml
#set the spec para

var_boardinfo_file="/mnt/jffs2/hw_boardinfo"
var_boardinfo_bakfile="/mnt/jffs2/hw_boardinfo.bak"
var_boardinfo_temp="/mnt/jffs2/hw_boardinfo.temp"

	cat $var_boardinfo_file | while read -r line;
	do
		obj_id_temp=`echo $line | sed 's/\(.*\)obj.value\(.*\)/\1/g'`
		obj_id=`echo $obj_id_temp | sed 's/\(.*\)"\(.*\)"\(.*\)/\2/g'`

		if [ "0x00000001" == $obj_id ];then
			echo "obj.id = \"0x00000001\" ; obj.value = \"4\";"
		else
			echo -E $line

		fi
	done  > $var_boardinfo_temp

	mv -f $var_boardinfo_temp $var_boardinfo_file
    rm -f /mnt/jffs2/hw_boardinfo.bak
	if [ -z $1 ]; then
		return 0
	fi
	if [ -x /bin/factparam ]; then
		/bin/factparam -v $1
		if [ 0 -ne $? ]; then
			echo "ERROR::Failed to validate boardinfo crc on $1!"
			return 1
		fi
	fi

	if [ -x /bin/factparam ]; then
		/bin/factparam -e reserved
		if [ 0 -ne $? ]; then
			echo "ERROR::Failed to clear factory parameter backup area!"
			return 1
		fi
	fi

sleep 5

reboot