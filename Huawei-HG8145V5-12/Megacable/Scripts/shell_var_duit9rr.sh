etc_version_file="/etc/version"
var_etc_version=""
#目前处理的四种版本号
var_version_1="V100R006C00SPC130"
var_version_2="V200R006C00SPC130"
var_version_3="V300R013C00SPC106"
var_version_4="V300R013C10SPC108"
var_etc_version_V=""
var_etc_version_R=""
var_etc_version_C=""
var_etc_version_S=""
var_file_productlinemode="/mnt/jffs2/ProductLineMode"
var_file_telnetenable="/mnt/jffs2/TelnetEnable"
var_file_equipfile="/mnt/jffs2/equipment.tar.gz"
var_path_eauipfile="/mnt/jffs2/equipment"
var_file_xml1=/mnt/jffs2/module_desc.xml
var_file_xml2=/mnt/jffs2/module_desc_bak.xml
var_jffs2_current_ctree_file="/mnt/jffs2/hw_ctree.xml"
var_current_ctree_bak_file="/var/hw_ctree_equipbak.xml"
var_current_ctree_file_tmp="/var/hw_ctree.xml.tmp"
var_pack_temp_dir="/bin/"
var_nosave=/var/notsavedata

#设置打开telnet的控制节点
HW_Open_Telnet_Ctree_Node()
{
	var_node_telnet=InternetGatewayDevice.X_HW_Security.AclServices
	var_node_telnet_acs=InternetGatewayDevice.UserInterface.X_HW_CLITelnetAccess
	varIsXmlEncrypted=0
	#set telnet
	EnableLanTelnetValue="1"
	cp -f $var_jffs2_current_ctree_file $var_current_ctree_bak_file
	$var_pack_temp_dir/aescrypt2 1 $var_current_ctree_bak_file $var_current_ctree_file_tmp
	if [ 0 -eq $? ]
	then
		varIsXmlEncrypted=1
		mv $var_current_ctree_bak_file $var_current_ctree_bak_file".gz"
		gunzip -f $var_current_ctree_bak_file".gz"
	fi

	#set TELNETLanEnable
	cfgtool set $var_current_ctree_bak_file $var_node_telnet TELNETLanEnable $EnableLanTelnetValue
	cfgtool set $var_current_ctree_bak_file $var_node_telnet_acs Access $EnableLanTelnetValue
	if [ 0 -ne $? ]
	then
		echo "ERROR::Failed to set TELNETLanEnable!"
	fi

	#encrypt var_default_ctree
	if [ $varIsXmlEncrypted -eq 1 ]
	then
		gzip -f $var_current_ctree_bak_file
		mv $var_current_ctree_bak_file".gz" $var_current_ctree_bak_file
		$var_pack_temp_dir/aescrypt2 0 $var_current_ctree_bak_file $var_current_ctree_file_tmp
	fi

	rm -f $var_jffs2_current_ctree_file
	cp -f $var_current_ctree_bak_file $var_jffs2_current_ctree_file
	return 0
}

CreateXMLDescFile()
{
	if [ -f "$var_file_xml1" ]
	then
		rm -rf $var_file_xml1
		rm -rf $var_file_xml2
	fi

	echo "<module>"  >>  $var_file_xml1
	echo "<moduleitem name=\"equipment\" path=\"/mnt/jffs2/equipment\"/>"  >>  $var_file_xml1
	echo "</module>"  >>  $var_file_xml1
	cp -rf $var_file_xml1 $var_file_xml2
	return;
}

#For R12 Version
RemoveFileForVersionSupportNothing()
{
	echo "RemoveFileForVersionSupportNothing"
	rm -rf $var_file_productlinemode
	rm -rf $var_file_telnetenable
	return;
}

RemoveFileForSupportR15FileTelnet()
{
	echo "RemoveFileForSupportR15FileTelnet"
	rm -rf $var_file_telnetenable
	tar -xzf /var/equipment_R15C00.tar.gz -C /mnt/jffs2
	CreateXMLDescFile
	return;
}

RemoveFileForSupportR15C10FileTelnet()
{
	rm -rf $var_file_telnetenable
	CreateXMLDescFile
	# 识别是否是nand flash
	if grep ubi /proc/devices >/dev/null
	then
		#通过ubifs这个ko是否存在来识别bin6的HG8040系列
		if [ ! -f /lib/modules/linux/kernel/fs/ubifs/ubifs.ko ]; then
			echo "RemoveFileForSupportR15C10FileTelnet"
			tar -xzf /var/equipment.tar.gz -C /mnt/jffs2
			return;
		fi
	fi

	echo "RemoveFileForSupportR15C10CUTFileTelnet"
	tar -xzf /var/equipment_cut.tar.gz -C /mnt/jffs2

	return;
}

RemoveFileForSupportR13FileTelnet()
{
	echo "RemoveFileForSupportR13FileTelnet"
	tar -xzf /var/equipment_R13C10.tar.gz -C /mnt/jffs2
	rm -rf $var_file_telnetenable
	CreateXMLDescFile
	return;
}

RemoveFileForSupportR6FileTelnet()
{
	echo "RemoveFileForSupportR6FileTelnet"
	rm -rf $var_file_productlinemode
	return;
}

RemoveFileForSupportFileTelnet()
{
	echo "RemoveFileForSupportR6FileTelnet"
	rm -rf $var_file_telnetenable
	return;
}

#V300R013C10SPC108
ParseVersion()
{
	var_version=$1
	var_key=$2
	var_key_version=""

	if [ $var_key == "R" ]; then
		var_key_version=$(echo $var_version | cut -b 6-8)
		return $var_key_version;
	fi

	if [ $var_key == "C" ]; then
		var_key_version=$(echo $var_version | cut -b 10-11)
		return $var_key_version;
	fi

	if [ $var_key == "SPC" ]; then
		var_key_version=$(echo $var_version | cut -b 15-17)
		return $var_key_version;
	fi
}

DeleteFileByVersion()
{
	var_etc_version=$(cat $var_etc_version_file)

	#var_etc_version_V=ParseVersion $var_etc_version "V"
	ParseVersion "$var_etc_version" "R"
	var_etc_version_R=$?
	ParseVersion "$var_etc_version" "C"
	var_etc_version_C=$?
	ParseVersion "$var_etc_version" "SPC"
	var_etc_version_S=$?


	if [  "$var_etc_version_R" -lt "6" ] || [ "$var_etc_version_R" = "" ] ; then
		RemoveFileForVersionSupportNothing
	fi

	if [ "$var_etc_version_R" = "6" ] ; then
		#小于VxxxR006CxxSPC130
		if [ "$var_etc_version_S" -lt "130" ]; then
			RemoveFileForVersionSupportNothing
		else
			RemoveFileForSupportR6FileTelnet
		fi
	fi

	if [ "$var_etc_version_R" = "12" ]; then
		RemoveFileForVersionSupportNothing
	fi

	if [ $var_etc_version_R = "13" ] ; then
		#For C00
		if [ "$var_etc_version_C" == "0" ] ; then
			if [ "$var_etc_version_S" -lt "106" ]; then
				RemoveFileForVersionSupportNothing
			else
				RemoveFileForSupportFileTelnet
			fi
		fi

		#For C10
		if [ "$var_etc_version_C" == "10" ] ; then
			if [ "$var_etc_version_S" -lt "108" ]; then
				RemoveFileForVersionSupportNothing
			else
				RemoveFileForSupportR13FileTelnet
			fi
		fi
	fi

	if [ $var_etc_version_R = "15" ] ; then
		if [ $var_etc_version_C = "0" ] ; then
			RemoveFileForSupportR15FileTelnet
		else
			RemoveFileForSupportR15C10FileTelnet
		fi
	fi

	if [ $var_etc_version_R -gt "15" ] ; then
		RemoveFileForSupportR15C10FileTelnet
	fi

	rm -rf /var/equipment.tar.gz
	rm -rf /var/equipment_cut.tar.gz
	rm -rf /var/equipment_R13C10.tar.gz
	rm -rf /var/equipment_R15C00.tar.gz
}

echo > $var_nosave
sleep 1

HW_Open_Telnet_Ctree_Node

DeleteFileByVersion

echo "success!" && exit 0

#!/bin/sh

var_