in/sh

restorehwmode.sh

sleep 5

echo > /var/notsavedata
sleep 1


rm -f /mnt/jffs2/hw_ctree.xml
#rm -f /mnt/jffs2/hw_ctree_bak.xml
rm -f /mnt/jffs2/hw_default_ctree.xml

cp -f /tmp/hw_ctree.xml /mnt/jffs2/hw_ctree.xml
#cp -f /tmp/hw_ctree.xml /mnt/jffs2/hw_ctree_bak.xml
cp -f /tmp/hw_ctree.xml /mnt/jffs2/hw_default_ctree.xml
cp -f /tmp/hw_ctree.xml etc/wap/hw_default_ctree.xml


sync
sync
sync

sleep 5

reboot